import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateIf, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
const safeText = /^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/;
export class FaqDto {
  @IsOptional() @IsUUID() id?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255) @Matches(safeText) question!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(5000) @Matches(safeText) answer!: string;
}
export class StoreInformationDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255) @Matches(safeText) shopName!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255) @Matches(safeText) businessCategory!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255)
  @Matches(/^[^\x00-\x1f\x7f]+$/, { message: "operatingHours must be a single line, for example Mon–Fri 09:30–18:00" }) operatingHours!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000) @Matches(safeText) description?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50)
  @Matches(/^(?:[+\d][\d ()-]{5,29})?$/, { message: "phone must contain 6–30 phone characters" }) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(255) @Matches(safeText)
  @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+)?$/, { message: "email must be a valid business email" }) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) @Matches(safeText) address?: string;
  // Omission preserves FAQs; [] archives only this merchant's FAQ records.
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => FaqDto) faqs?: FaqDto[];
}
export class CreateOnboardingStoreDto extends StoreInformationDto {
  @IsUUID() requestId!: string;
}
export class UpdateStoreInformationDto extends StoreInformationDto {
  @IsInt() @Min(0) revision!: number;
}
