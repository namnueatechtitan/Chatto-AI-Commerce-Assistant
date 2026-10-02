const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Workbook } = require("exceljs");
const { parseCatalog, previewTable, inspectXlsx } = require("../dist/modules/catalog-imports/catalog-parser");
const { validateCatalogFile } = require("../dist/modules/catalog-imports/catalog-imports.service");
const { plainToInstance } = require("class-transformer");
const { validate } = require("class-validator");
const { CreateOnboardingStoreDto, UpdateStoreInformationDto } = require("../dist/modules/store-information/store-information.dto");
const { storeInformationReady } = require("../dist/modules/store-information/store-information.service");

// Minimal real, text-based PDF fixture, with a valid cross-reference table.
function pdfFixture(lines = [], pages = 1, extra = "") {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${Array.from({length: pages},(_,i)=>`${4+i*2} 0 R`).join(" ")}] /Count ${pages} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  for (let i = 0; i < pages; i++) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
    const text = "BT /F1 10 Tf 40 740 Td " + lines.map((line, index) => `${index ? "0 -20 Td " : ""}(${line.replace(/[()\\]/g,"\\$&")}) Tj`).join(" ") + " ET";
    objects.push(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
  }
  let result = "%PDF-1.7\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(result)); result += `${i+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n \n`).join("");
  result += `trailer\n<< /Size ${offsets.length} /Root 1 0 R ${extra} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
async function withFile(buffer, format, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chatto-catalog-test-"));
  const filename = path.join(directory, `catalog.${format}`);
  try { await fs.writeFile(filename, buffer); return await callback(filename); }
  finally { await fs.rm(directory, {recursive: true, force: true}); }
}
test("CSV supports UTF-8 Thai, BOM, quotes, row errors, ignored commerce columns and normalized duplicates", async () => {
  const csv = Buffer.from('\ufeffname,description,category,brand,stock\r\nดอกไม้,"ช่อ, สีชมพู",flowers,Chatto,4\r\n,,flowers,,0\r\nดอกไม้,duplicate,,,5\r\n');
  const preview = await withFile(csv, "csv", path=>parseCatalog(path,"csv"));
  assert.equal(preview.validCount,1); assert.equal(preview.rows[0].product.description,"ช่อ, สีชมพู");
  assert.ok(preview.rows[1].errors.some(error=>error.includes("required")));
  assert.ok(preview.rows[2].errors.some(error=>error.includes("Duplicate")));
  assert.ok(preview.warnings[0].includes("stock")); assert.equal(preview.rows[0].product.stock,undefined);
});
test("CSV rejects malformed UTF-8, missing headers, overlong fields, excess rows and columns", async () => {
  await assert.rejects(withFile(Buffer.from([0xff,0xfe]),"csv",path=>parseCatalog(path,"csv")));
  assert.throws(()=>previewTable([["other"],["value"]]),/column is required/);
  assert.throws(()=>previewTable([["name"],...Array.from({length:501},()=>["name"])]),/500 rows/);
  assert.throws(()=>previewTable([Array(13).fill("name"),["name"]]),/12 columns/);
  assert.throws(()=>previewTable([["name","name"],["A","B"]]),/Duplicate product columns/);
  assert.equal(previewTable([["name"],["a".repeat(256)]]).validCount,0);
  const prototypeColumns=previewTable([["name","constructor","__proto__"],["A","ignored","ignored"]]);
  assert.deepEqual(Object.keys(prototypeColumns.rows[0].product).sort(),["brand","category","description","name"]);assert.equal(prototypeColumns.warnings.length,2);
});
test("XLSX preflight rejects macros, unsafe XML and ZIP expansion bombs",async()=>{
  const {createRequire}=require('node:module');const JSZip=createRequire(require.resolve('exceljs'))('jszip');
  const archive=()=>new JSZip().file('[Content_Types].xml','<Types/>').file('xl/workbook.xml','<workbook/>');
  for(const zip of [archive().file('xl/vbaProject.bin','macro'),archive().file('xl/sheet.xml','<!DOCTYPE x [<!ENTITY ext SYSTEM "file:///secret">]><x/>'),archive().file('xl/sharedStrings.xml','a'.repeat(2*1024*1024))]) {
    await assert.rejects(inspectXlsx(await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})),/unsupported|limit exceeded/);
  }
});
test("XLSX reads one real worksheet, rejects formulas, multiple sheets and corrupt ZIP signatures", async () => {
  const workbook = new Workbook(); const sheet = workbook.addWorksheet("Catalog"); sheet.addRows([["name","description","category","brand"],["ดอกไม้","ช่อสีชมพู","flowers","Chatto"]]);
  const parse = async ()=>withFile(Buffer.from(await workbook.xlsx.writeBuffer()),"xlsx",path=>parseCatalog(path,"xlsx"));
  assert.equal((await parse()).rows[0].product.name,"ดอกไม้");
  sheet.getCell("A2").value={formula:"1+1",result:2}; await assert.rejects(parse(),/Formula/);
  sheet.getCell("A2").value="A"; workbook.addWorksheet("Another").addRow(["B"]); await assert.rejects(parse(),/one visible worksheet/);
  await assert.rejects(withFile(Buffer.from("PK fake zip"),"xlsx",path=>parseCatalog(path,"xlsx")),/Invalid XLSX/);
});
test("PDF extracts only explicit product tables and never invents rows from prose/scans", async () => {
  const preview = await withFile(pdfFixture(["name | description | category | brand","Flower | Fresh bouquet | flowers | Chatto"]),"pdf",path=>parseCatalog(path,"pdf"));
  assert.equal(preview.validCount,1); assert.equal(preview.rows[0].product.name,"Flower"); assert.ok(preview.warnings.length);
  const named=await withFile(pdfFixture(["name | description | category | brand","name | Fresh bouquet | flowers | Chatto"]),"pdf",path=>parseCatalog(path,"pdf"));assert.equal(named.validCount,1,'a product named name is not mistaken for a repeated header');
  await assert.rejects(withFile(pdfFixture(["This is a product catalogue with arbitrary prose"]),"pdf",path=>parseCatalog(path,"pdf")),/Unstructured PDF/);
  await assert.rejects(withFile(pdfFixture(),"pdf",path=>parseCatalog(path,"pdf")),/OCR is not supported/);
  await assert.rejects(withFile(pdfFixture([],21),"pdf",path=>parseCatalog(path,"pdf")),/20-page/);
  await assert.rejects(withFile(Buffer.from("%PDF-broken"),"pdf",path=>parseCatalog(path,"pdf")));
});
test("upload validation rejects size, MIME mismatch, binary CSV, fake PDFs/XLSX and prototype extension names", () => {
  const file = (originalname,mimetype,buffer,size=buffer.length)=>({originalname,mimetype,buffer,size});
  assert.equal(validateCatalogFile(file("catalog.csv","text/csv",Buffer.from("name\nFlower"))),"csv");
  for (const input of [file("x.csv","application/pdf",Buffer.from("name\nA")),file("x.pdf","application/pdf",Buffer.from("not pdf")),file("x.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",Buffer.from("bad zip")),file("x.csv","text/csv",Buffer.from([0,1])),file("x.__proto__","text/plain",Buffer.from("name")),file("x.csv","text/csv",Buffer.from("name"),6*1024*1024)]) assert.throws(()=>validateCatalogFile(input),error=>error.getStatus()===400);
});
test("DTOs trim required fields, validate optional contacts and FAQ limits, and reject null FAQ payloads", async () => {
  const valid={shopName:"  Thai Shop  ",businessCategory:"flowers",operatingHours:"Mon–Fri 09:30–18:00",requestId:crypto.randomUUID(),faqs:[]};
  const dto=plainToInstance(CreateOnboardingStoreDto,valid); assert.equal((await validate(dto)).length,0);assert.equal(dto.shopName,"Thai Shop");
  for(const fields of [{shopName:"  "},{shopName:"A\0B"},{address:"A\0B"},{operatingHours:"\n"},{email:"bad"},{phone:"abc"},{faqs:null},{faqs:[{question:"Q",answer:""}]},{faqs:Array.from({length:51},()=>({question:"Q",answer:"A"}))}]) assert.ok((await validate(plainToInstance(CreateOnboardingStoreDto,{...valid,...fields}))).length);
  assert.ok((await validate(plainToInstance(UpdateStoreInformationDto,{...valid,revision:-1}))).length);
  assert.ok(storeInformationReady({...dto,status:"TRIAL"},"Owner"));
  assert.equal(storeInformationReady({...dto,status:"TRIAL"},"Staff"),false);
  assert.equal(storeInformationReady({...dto,status:"TRIAL",operatingHours:null},"Owner"),false);
});

module.exports={pdfFixture};
