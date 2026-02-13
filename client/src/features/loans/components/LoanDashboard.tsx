import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Home,
  Car,
  Banknote,
  ArrowRightLeft,
  TrendingUp,
  Calculator,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { BASE_URL, getAuthHeaders } from '@/api';
import { HomeLoanCalculator } from './HomeLoanCalculator';
import { CarFinanceCalculator } from './CarFinanceCalculator';
import { PersonalLoanCalculator } from './PersonalLoanCalculator';
import { LoanComparisonPanel } from './LoanComparisonPanel';
import { RefinanceAnalysis } from './RefinanceAnalysis';
import { BorrowingCapacity } from './BorrowingCapacity';
import { RateScenarios } from './RateScenarios';

interface MarketRates {
  lowest_variable: number;
  lowest_2yr_fixed: number;
  average_variable: number;
  average_fixed: number;
  total_products: number;
  total_providers: number;
  last_updated: string;
  source: string;
}

export function LoanDashboard() {
  const [marketRates, setMarketRates] = useState<MarketRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);

  useEffect(() => {
    async function loadMarketRates() {
      try {
        const res = await fetch(`${BASE_URL}/api/cdr/rates/market?category=RESIDENTIAL_MORTGAGES`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          setMarketRates(await res.json());
        }
      } catch {
        // Market rates are optional — gracefully degrade
      } finally {
        setRatesLoading(false);
      }
    }
    loadMarketRates();
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-gradient-gold">
          Loan Calculators
        </h2>
        <p className="text-xs sm:text-sm text-zinc-500">
          Australian loan comparison tools with CDR market rates, offset, refinance, and
          APRA-compliant capacity estimates
        </p>
      </div>

      {/* Market Rates Banner */}
      {ratesLoading ? (
        <Card className="neu-raised border-[#FFCC00]/10">
          <CardContent className="py-4 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading CDR market rates...
          </CardContent>
        </Card>
      ) : marketRates ? (
        <Card className="neu-raised border-[#FFCC00]/10 bg-gradient-to-r from-[#FFCC00]/5 to-transparent">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#FFCC00]" />
                <span className="text-sm font-medium text-[#FFCC00]">CDR Market Rates</span>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 flex-wrap">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Lowest Variable
                  </p>
                  <p className="text-base sm:text-lg font-bold text-emerald-400">
                    {(marketRates.lowest_variable * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Lowest 2yr Fixed
                  </p>
                  <p className="text-base sm:text-lg font-bold text-blue-400">
                    {(marketRates.lowest_2yr_fixed * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Avg Variable</p>
                  <p className="text-base sm:text-lg font-bold text-zinc-300">
                    {(marketRates.average_variable * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Products</p>
                  <p className="text-base sm:text-lg font-bold text-zinc-300">
                    {marketRates.total_products}
                  </p>
                </div>
              </div>
              <Badge className="bg-white/5 text-zinc-500 border-white/10 text-[10px]">
                {marketRates.source} &middot; {marketRates.total_providers} providers
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="home" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 overflow-x-auto">
          <TabsTrigger value="home" className="min-h-[44px]">
            <Home className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Home Loan</span>
            <span className="sm:hidden">Home</span>
          </TabsTrigger>
          <TabsTrigger value="car" className="min-h-[44px]">
            <Car className="w-4 h-4 mr-1 sm:mr-2" />
            Car
          </TabsTrigger>
          <TabsTrigger value="personal" className="min-h-[44px]">
            <Banknote className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Personal Loan</span>
            <span className="sm:hidden">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="min-h-[44px]">
            <ArrowRightLeft className="w-4 h-4 mr-1 sm:mr-2" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="refinance" className="min-h-[44px]">
            <TrendingUp className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Refinance</span>
            <span className="sm:hidden">Refi</span>
          </TabsTrigger>
          <TabsTrigger value="capacity" className="min-h-[44px]">
            <Calculator className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Borrowing Capacity</span>
            <span className="sm:hidden">Capacity</span>
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="min-h-[44px]">
            <BarChart3 className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Rate Scenarios</span>
            <span className="sm:hidden">Rates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home">
          <HomeLoanCalculator />
        </TabsContent>

        <TabsContent value="car">
          <CarFinanceCalculator />
        </TabsContent>

        <TabsContent value="personal">
          <PersonalLoanCalculator />
        </TabsContent>

        <TabsContent value="compare">
          <LoanComparisonPanel />
        </TabsContent>

        <TabsContent value="refinance">
          <RefinanceAnalysis />
        </TabsContent>

        <TabsContent value="capacity">
          <BorrowingCapacity />
        </TabsContent>

        <TabsContent value="scenarios">
          <RateScenarios />
        </TabsContent>
      </Tabs>
    </div>
  );
}
