import { CHART_COLORS } from '@/components/charts';
import { freshnessColor } from './utils';
import type { AssetAllocation, DepreciationAsset, AssetValuePoint, TreeMapCategory } from './types';

export const ASSET_ALLOCATION: AssetAllocation[] = [
  { name: 'Equipment', value: 185000, color: CHART_COLORS.primary },
  { name: 'Vehicles', value: 120000, color: '#2E86C1' },
  { name: 'Property', value: 450000, color: '#28B463' },
  { name: 'Inventory', value: 67000, color: '#FF9500' },
  { name: 'Intangibles', value: 35000, color: '#8E44AD' },
];

export const DEPRECIATION_SCHEDULE: DepreciationAsset[] = [
  { name: 'CNC Machine', originalCost: 95000, bookValue: 62000, currentYearDep: 9500 },
  { name: 'Delivery Van', originalCost: 55000, bookValue: 28000, currentYearDep: 11000 },
  { name: 'Office Fitout', originalCost: 42000, bookValue: 31500, currentYearDep: 4200 },
  { name: 'Warehouse', originalCost: 450000, bookValue: 405000, currentYearDep: 11250 },
  { name: 'Forklift', originalCost: 38000, bookValue: 15200, currentYearDep: 7600 },
  { name: 'IT Systems', originalCost: 28000, bookValue: 9800, currentYearDep: 7000 },
];

export function generateAssetValueOverTime(): AssetValuePoint[] {
  const data: AssetValuePoint[] = [];
  const years = ['FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25'];
  let equip = 120000,
    veh = 65000,
    prop = 480000;
  for (const year of years) {
    data.push({ year, equipment: equip, vehicles: veh, property: prop });
    equip = Math.round(equip * 0.9 + (year === 'FY22' ? 40000 : 0));
    veh = Math.round(veh * 0.8 + (year === 'FY23' ? 55000 : 0));
    prop = Math.round(prop * 0.975);
  }
  const lastActual = data[data.length - 1]!;
  let eqProj = lastActual.equipment;
  let vhProj = lastActual.vehicles;
  let prProj = lastActual.property;
  for (const fy of ['FY26', 'FY27', 'FY28']) {
    eqProj = Math.round(eqProj * 0.9);
    vhProj = Math.round(vhProj * 0.8);
    prProj = Math.round(prProj * 0.975);
    data.push({
      year: fy,
      equipment: fy === 'FY26' ? lastActual.equipment : (undefined as unknown as number),
      vehicles: fy === 'FY26' ? lastActual.vehicles : (undefined as unknown as number),
      property: fy === 'FY26' ? lastActual.property : (undefined as unknown as number),
      equipmentProj: eqProj,
      vehiclesProj: vhProj,
      propertyProj: prProj,
    });
  }
  const bridgeIdx = years.length - 1;
  const bridgeItem = data[bridgeIdx]!;
  data[bridgeIdx] = {
    ...bridgeItem,
    equipmentProj: bridgeItem.equipment,
    vehiclesProj: bridgeItem.vehicles,
    propertyProj: bridgeItem.property,
  };
  return data;
}

export const INVENTORY_CATEGORIES: TreeMapCategory[] = [
  {
    name: 'Raw Materials',
    children: [
      { name: 'Steel', value: 18000, fill: freshnessColor(5) },
      { name: 'Aluminium', value: 12000, fill: freshnessColor(15) },
      { name: 'Timber', value: 8000, fill: freshnessColor(45) },
      { name: 'Plastic', value: 5000, fill: freshnessColor(90) },
    ],
  },
  {
    name: 'Work in Progress',
    children: [
      { name: 'Assembly A', value: 14000, fill: freshnessColor(3) },
      { name: 'Assembly B', value: 9000, fill: freshnessColor(12) },
    ],
  },
  {
    name: 'Finished Goods',
    children: [
      { name: 'Product X', value: 22000, fill: freshnessColor(8) },
      { name: 'Product Y', value: 16000, fill: freshnessColor(60) },
      { name: 'Product Z', value: 7000, fill: freshnessColor(120) },
    ],
  },
];
