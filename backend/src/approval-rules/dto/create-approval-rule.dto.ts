import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { APPROVAL_TYPES } from '../../common/domain.types';
import type { ApprovalType } from '../../common/domain.types';

export class CreateApprovalStepDto {
  @IsUUID()
  approverId: string;

  @IsInt()
  @Min(0)
  sequence: number;

  @IsBoolean()
  isManagerApprover: boolean;
}

export class CreateApprovalRuleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsIn(APPROVAL_TYPES)
  type: ApprovalType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentageThreshold?: number;

  @IsOptional()
  @IsUUID()
  specificApproverId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateApprovalStepDto)
  steps: CreateApprovalStepDto[] = [];
}
