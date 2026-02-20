import { useState, useEffect, useCallback } from 'react';
import {
  fetchEmployee,
  updateEmployee,
  fetchBankDetails,
  fetchSuperFund,
  fetchTaxDeclaration,
  fetchPayStructure,
} from '../../../../../api';
import type {
  DetailTab,
  EmployeeRecord,
  BankDetailRecord,
  SuperFundRecord,
  TaxDeclarationRecord,
  PayStructureRecord,
} from '../types.js';

export function useEmployeeData(employeeId: string) {
  const [activeTab, setActiveTab] = useState<DetailTab>('personal');
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetailRecord[]>([]);
  const [superFund, setSuperFund] = useState<SuperFundRecord | null>(null);
  const [taxDeclaration, setTaxDeclaration] = useState<TaxDeclarationRecord | null>(null);
  const [payStructure, setPayStructureData] = useState<PayStructureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const emp = await fetchEmployee(employeeId);
      setEmployee(emp);

      const [bank, sup, tax, pay] = await Promise.all([
        fetchBankDetails(employeeId).catch(() => ({ data: [] })),
        fetchSuperFund(employeeId).catch(() => ({ data: null })),
        fetchTaxDeclaration(employeeId).catch(() => null),
        fetchPayStructure(employeeId).catch(() => ({ data: [] })),
      ]);

      setBankDetails(bank.data ?? []);
      setSuperFund(sup.data ?? null);
      setTaxDeclaration(tax);
      setPayStructureData(pay.data ?? []);
    } catch (e) {
      console.error('Failed to load employee', e);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSavePersonal = async () => {
    try {
      await updateEmployee(employeeId, editData);
      setEmployee({ ...employee, ...editData });
      setEditing(null);
      setEditData({});
    } catch (e) {
      console.error('Failed to save', e);
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditData({});
  };

  return {
    activeTab,
    setActiveTab,
    employee,
    bankDetails,
    superFund,
    taxDeclaration,
    payStructure,
    loading,
    editing,
    setEditing,
    editData,
    setEditData,
    loadData,
    handleSavePersonal,
    handleCancelEdit,
  };
}
