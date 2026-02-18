export interface AssetAllocation {
  name: string;
  value: number;
  color: string;
}

export interface DepreciationAsset {
  name: string;
  originalCost: number;
  bookValue: number;
  currentYearDep: number;
}

export interface AssetValuePoint {
  year: string;
  equipment: number;
  vehicles: number;
  property: number;
  equipmentProj?: number;
  vehiclesProj?: number;
  propertyProj?: number;
}

export interface InventoryItem {
  name: string;
  value: number;
  daysSinceRestock: number;
}

export interface TreeMapLeaf {
  name: string;
  value: number;
  fill: string;
}

export interface TreeMapCategory {
  name: string;
  children: TreeMapLeaf[];
}

export interface TreeMapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  value?: number;
  fill?: string;
}

export interface CenterLabelProps {
  viewBox?: { cx: number; cy: number };
  total: number;
}
