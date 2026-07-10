import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'O nome completo do usuário' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name!: string;

  @ApiProperty({ example: 'user@example.com', description: 'O endereço de e-mail do usuário' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @ApiProperty({ example: '123456', description: 'A senha do usuário (mínimo de 6 caracteres)' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(6, { message: 'A senha deve conter no mínimo 6 caracteres' })
  password!: string;
}
