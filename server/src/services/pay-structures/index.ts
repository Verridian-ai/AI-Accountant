/**
 * Pay Structures Service — barrel re-export.
 */
export type {
  PayCategoryType,
  PayRateType,
  CreatePayCategoryInput,
  UpdatePayCategoryInput,
  ListPayCategoriesOptions,
  SetPayStructureInput,
  GrossPayResult,
} from './types.js';
export { PayStructureService, payStructureService } from './pay-structure-service.js';
