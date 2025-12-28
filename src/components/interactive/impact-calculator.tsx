'use client';

import React, { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Store, Eye, Users, TrendingUp } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import { Label } from "../ui/label";

const ImpactCalculator = () => {
  const [budget, setBudget] = useState(2250);

  const calculatedImpact = useMemo(() => {
    const costPerShop = 750; // Average cost per shop per month
    const impressionsPerShop = 6000;
    const customersPerRupee = 50 / 750; // 50 customers per shop cost

    const shops = Math.floor(budget / costPerShop);
    const impressions = shops * impressionsPerShop;
    const customers = Math.floor(budget * customersPerRupee * 50);
    
    return { shops, impressions, customers };
  }, [budget]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Card className="w-full overflow-hidden">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-2xl flex items-center justify-center gap-2">
            <TrendingUp /> Brand Impact Calculator
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Slide to adjust your monthly budget and see your potential reach.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8 pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
                <Label htmlFor="budget" className="text-lg font-medium">Monthly Budget</Label>
                <p className="font-headline text-3xl font-bold text-primary">₹{budget.toLocaleString('en-IN')}</p>
            </div>
            <Slider
              id="budget"
              min={800}
              max={15000}
              step={100}
              value={[budget]}
              onValueChange={(value) => setBudget(value[0])}
            />
             <div className="flex justify-between text-xs text-muted-foreground">
                <span>₹800</span>
                <span>₹15,000</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <ImpactMetric
                icon={Store}
                label="Partner Shops"
                value={calculatedImpact.shops}
                color="text-primary"
            />
            <ImpactMetric
                icon={Eye}
                label="Monthly Impressions"
                value={calculatedImpact.impressions}
                color="text-primary"
            />
            <ImpactMetric
                icon={Users}
                label="Potential New Customers"
                value={calculatedImpact.customers}
                color="text-primary"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


function ImpactMetric({ icon: Icon, label, value, color }: { icon: React.ElementType, label: string, value: number, color: string }) {
    const { count, ref } = useCountUp(value, 1000);

    return (
        <div ref={ref} className="bg-secondary/50 p-6 rounded-lg flex flex-col items-center gap-2">
            <Icon className={`h-10 w-10 ${color}`} />
            <p className="font-headline text-4xl font-bold text-foreground">{count.toLocaleString('en-IN')}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    )
}


export default ImpactCalculator;
