import { Transform } from "class-transformer";
import { IsInt, IsString, Matches, MaxLength, Min, ValidateIf } from "class-validator";
export class LineRevisionDto {
  @IsInt() @Min(0) expectedRevision!: number;
}
export class ConfigureLineDto extends LineRevisionDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  // Only omission means reuse. Null or an explicitly empty credential is invalid.
  @ValidateIf((_, value) => value !== undefined)
  @IsString() @Matches(/^[0-9]{1,255}$/) externalChannelId?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString() @Matches(/^[0-9a-fA-F]{32}$/) channelSecret?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString() @MaxLength(4096) @Matches(/^[\x21-\x7e]{16,4096}$/) channelAccessToken?: string;
}
