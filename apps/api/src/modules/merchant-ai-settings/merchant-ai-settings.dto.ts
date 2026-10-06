import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsString, IsUUID, Matches, MaxLength, ValidateIf, ValidateNested } from "class-validator";
import { AI_FALLBACKS, AI_LENGTHS, AI_TONES } from "./merchant-ai-settings.types";
const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
const safeText = /^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/;
const provided = (_object: unknown, value: unknown) => value !== undefined;
export class AiCapabilitiesDto {
  @IsBoolean() recommendProducts!: boolean;
  @IsBoolean() checkStock!: boolean;
  @IsBoolean() compareProducts!: boolean;
  @IsBoolean() answerFaq!: boolean;
  @IsBoolean() showPrices!: boolean;
  @IsBoolean() rememberCustomerInterest!: boolean;
  @IsBoolean() showPromotions!: boolean;
  @IsBoolean() recommendRelatedProducts!: boolean;
}
export class MerchantAiRuleDto {
  @ValidateIf(provided) @IsUUID() id?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(500) @Matches(safeText) text!: string;
}
export class UpdateMerchantAiSettingsDto {
  @ValidateIf(provided) @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) @Matches(safeText) assistantName?: string;
  @ValidateIf(provided) @Transform(trim) @IsString() @MaxLength(80) @Matches(safeText) pronoun?: string;
  @ValidateIf(provided) @IsIn(AI_TONES) tone?: typeof AI_TONES[number];
  @ValidateIf(provided) @IsIn(["th", "en"]) language?: "th" | "en";
  @ValidateIf(provided) @IsBoolean() useEmoji?: boolean;
  @ValidateIf(provided) @IsIn(AI_LENGTHS) responseLength?: typeof AI_LENGTHS[number];
  @ValidateIf(provided) @IsObject() @ValidateNested() @Type(() => AiCapabilitiesDto) capabilities?: AiCapabilitiesDto;
  @ValidateIf(provided) @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => MerchantAiRuleDto) rules?: MerchantAiRuleDto[];
  @ValidateIf(provided) @IsIn(AI_FALLBACKS) fallbackBehavior?: typeof AI_FALLBACKS[number];
}
