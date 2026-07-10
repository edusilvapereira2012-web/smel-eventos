import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a6b7c8d9-1234-5678-90ab-cdef12345678', description: 'Token de recuperação de senha enviado por e-mail' })
  @IsNotEmpty({ message: 'O token é obrigatório' })
  token!: string;

  @ApiProperty({ example: 'newpassword123', description: 'A nova senha do usuário (mínimo de 6 caracteres)' })
  @IsNotEmpty({ message: 'A nova senha é obrigatória' })
  @MinLength(6, { message: 'A senha deve conter no mínimo 6 caracteres' })
  password!: string;
}
