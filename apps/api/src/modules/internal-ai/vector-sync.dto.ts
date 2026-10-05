import { Type } from "class-transformer";
import { IsArray, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";

export class VectorSyncDocumentDto {
  @IsOptional() @IsUUID() id?: string;
  @IsUUID() merchant_id!: string;
  @IsString() @MaxLength(100) source_type!: string;
  @IsUUID() source_id!: string;
  @IsString() chunk_text!: string;
  @IsOptional() @IsArray() @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true }) embedding?: number[] | null;
  @IsOptional() @IsObject() metadata?: Record<string, unknown> | null;
  @IsString() status!: string;
}

export class VectorDocumentSyncDto {
  @IsUUID() merchant_id!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => VectorSyncDocumentDto)
  documents!: VectorSyncDocumentDto[];
}
