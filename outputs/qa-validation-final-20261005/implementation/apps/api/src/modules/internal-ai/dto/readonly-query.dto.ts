import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class ReadonlyQueryDto {
  @IsUUID()
  merchant_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  sql!: string;
}
