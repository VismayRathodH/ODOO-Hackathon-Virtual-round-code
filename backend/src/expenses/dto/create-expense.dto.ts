import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateExpenseDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsString()
  @IsIn(['Travel', 'Food', 'Accommodation', 'Equipment', 'Other'])
  category: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsUrl()
  receiptUrl?: string;
}