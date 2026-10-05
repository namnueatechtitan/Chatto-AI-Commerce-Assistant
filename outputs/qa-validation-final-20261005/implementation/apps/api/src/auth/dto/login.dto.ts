import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "merchant@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "strong-password" })
  @IsString()
  @MinLength(8)
  password!: string;
}
// placeholder DTO for login endpoint, with email and password fields validated using class-validator decorators. The email field must be a valid email address, and the password field must be a string with a minimum length of 8 characters.