import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class SignUpDto {
  @IsString()
  @MinLength(1, { message: 'First name cannot be empty' })
  @MaxLength(100)
  firstName: string = "";

  @IsString()
  @MinLength(1, { message: 'Last name cannot be empty' })
  @MaxLength(100)
  lastName: string = "";

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(254)
  email: string = "";

  @IsString()
  @MinLength(15, { message: 'Password must be at least 15 characters long' })
  @MaxLength(128, { message: 'Password must be no more than 128 characters long' })
  password: string = "";
}
