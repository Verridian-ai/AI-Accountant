import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchPayCategories,
  fetchPayStructure,
  setPayStructure,
  fetchEmployee,
} from '../../../../../api';
import type { EmployeeSummary, PayCategory, PayStructureItem, PaySummary } from '../types.js';
import { SUPER_RATE } from '../constants.js';
import { today } from '../helpers.js';

export function usePayStructure(employeeId: string) {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [categories, setCategories] = useState<PayCategory[]>([]);
  const [items, setItems] = useState<PayStructureItem[]>([]);
  const [allItems, setAllItems] = useState<PayStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formHoursPerWeek, setFormHoursPerWeek] = useState('38');
  const [formAnnualSalary, setFormAnnualSalary] = useState('');
  const [formEffectiveDate, setFormEffectiveDate] = useState(today());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empResult, catResult, structResult] = await Promise.all([
        fetchEmployee(employeeId),
        fetchPayCategories('default'),
        fetchPayStructure(employeeId),
      ]);
      setEmployee(empResult);
      setCategories((catResult.data ?? []).filter((c: PayCategory) => c.isActive));

      const structItems: PayStructureItem[] = structResult?.items ?? structResult?.data ?? [];
      setAllItems(structItems);
      setItems(structItems.filter((it: PayStructureItem) => it.isActive));
    } catch (e) {
      console.error('Failed to load pay structure data', e);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === formCategoryId),
    [categories, formCategoryId],
  );

  const summary: PaySummary = useMemo(() => {
    let weeklyGross = 0;
    let annualTotal = 0;
    let oteBasis = 0;

    for (const item of items) {
      const rateInDollars = item.rateCents / 100;
      const multiplier = item.multiplier || 1;

      if (item.rateType === 'hourly') {
        const hours = item.hoursPerWeek ?? 38;
        const weeklyItem = rateInDollars * hours * multiplier;
        weeklyGross += weeklyItem;
        annualTotal += weeklyItem * 52;
        if (item.categoryType === 'ordinary' || item.categoryType === 'leave') {
          oteBasis += weeklyItem * 52;
        }
      } else if (item.rateType === 'annual') {
        const annual =
          item.annualSalaryCents != null ? item.annualSalaryCents / 100 : rateInDollars;
        weeklyGross += annual / 52;
        annualTotal += annual;
        if (item.categoryType === 'ordinary') {
          oteBasis += annual;
        }
      } else {
        weeklyGross += rateInDollars * multiplier;
        annualTotal += rateInDollars * multiplier * 52;
      }
    }

    const superAmount = oteBasis * SUPER_RATE;

    return {
      weekly: weeklyGross,
      fortnightly: weeklyGross * 2,
      monthly: annualTotal / 12,
      annual: annualTotal,
      superAnnual: superAmount,
      superMonthly: superAmount / 12,
    };
  }, [items]);

  const resetForm = () => {
    setFormCategoryId('');
    setFormRate('');
    setFormHoursPerWeek('38');
    setFormAnnualSalary('');
    setFormEffectiveDate(today());
    setShowForm(false);
  };

  const handleCategoryChange = (catId: string) => {
    setFormCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat?.defaultRateCents != null) {
      setFormRate((cat.defaultRateCents / 100).toFixed(2));
    }
  };

  const handleAddPayItem = async () => {
    if (!formCategoryId || !formRate) return;

    const cat = categories.find((c) => c.id === formCategoryId);
    if (!cat) return;

    setSaving(true);
    try {
      const rateCents = Math.round(parseFloat(formRate) * 100);
      const hoursPerWeek = cat.rateType === 'hourly' ? parseFloat(formHoursPerWeek) || 38 : null;
      const annualSalaryCents =
        cat.rateType === 'annual' ? Math.round(parseFloat(formAnnualSalary) * 100) : null;

      await setPayStructure(employeeId, {
        payCategoryId: formCategoryId,
        rateCents,
        hoursPerWeek,
        annualSalaryCents,
        multiplier: cat.multiplier ?? 1,
        effectiveDate: formEffectiveDate,
      });
      resetForm();
      await loadData();
    } catch (e) {
      console.error('Failed to add pay item', e);
    } finally {
      setSaving(false);
    }
  };

  const displayItems = showHistory ? allItems : items;

  return {
    employee,
    categories,
    items,
    allItems,
    displayItems,
    loading,
    showHistory,
    setShowHistory,
    showForm,
    setShowForm,
    saving,
    formCategoryId,
    formRate,
    formHoursPerWeek,
    formAnnualSalary,
    formEffectiveDate,
    setFormRate,
    setFormHoursPerWeek,
    setFormAnnualSalary,
    setFormEffectiveDate,
    selectedCategory,
    summary,
    resetForm,
    handleCategoryChange,
    handleAddPayItem,
  };
}
