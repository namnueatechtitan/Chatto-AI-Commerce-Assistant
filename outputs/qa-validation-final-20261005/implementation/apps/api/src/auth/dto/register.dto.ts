import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "merchant@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "strong-password" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: "Acme Store" })
  @IsString()
  shopName!: string;

  @ApiProperty({ example: "Alice Merchant" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "Retail", required: false })
  @IsOptional()
  @IsString()
  businessCategory?: string;
}

// placehjolder DTO for register endpoint, with email, password, shopName, name, and optional businessCategory fields validated using class-validator decorators. The email field must be a valid email address, the password field must be a string with a minimum length of 8 characters, and the other fields must be strings.