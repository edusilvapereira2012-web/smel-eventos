import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'O e-mail do usuário' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @ApiProperty({ example: '123456', description: 'A senha do usuário' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password!: string;
}
