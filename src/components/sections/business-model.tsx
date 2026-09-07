import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Check, ArrowRight, Star } from 'lucide-react';

// Store tiers — must match the checkout rates in lib/slot-pricing.ts
// (Standard ₹1,000 / Growth ₹2,000 / Flagship ₹3,000 per screen per month).
const plans = [
  {
    name: 'Standard',
    price: '1,000',
    description: 'Local kirana screens with a loyal daily footfall.',
    features: [
      '~144 plays per day per screen',
      '~4,320 monthly views per screen',
      'Targeted local reach',
      'Campaign performance reporting'
    ],
    isPopular: false,
  },
  {
    name: 'Growth',
    price: '2,000',
    description: 'Busy neighbourhood anchor stores with heavier walk-ins.',
    features: [
      'Everything in Standard',
      'High-footfall locations',
      'Detailed analytics & insights',
      'Priority support'
    ],
    isPopular: true,
  },
  {
    name: 'Flagship',
    price: '3,000',
    description: 'Premium high-visibility stores at prime locations.',
    features: [
      'Everything in Growth',
      'Prime, high-visibility placements',
      'Dedicated account manager',
      'Custom creative support'
    ],
    isPopular: false,
  },
];

type BusinessModelProps = {
  onGetStartedClick: () => void;
};

export default function BusinessModel({ onGetStartedClick }: BusinessModelProps) {
  return (
    <section id="business-model" className="bg-background">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">
          Find a Plan That Works for You
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Every store is tiered by footfall and visibility. Pick the exact stores you
          want at booking — mix tiers freely in one campaign.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className={`flex flex-col ${plan.isPopular ? 'border-primary border-2' : ''}`}>
               {plan.isPopular && (
                <div className="bg-primary text-primary-foreground text-sm font-bold py-1 px-4 rounded-t-lg -mt-px flex items-center justify-center gap-2">
                  <Star className="w-4 h-4" /> Most Popular
                </div>
              )}
              <CardHeader className="text-left">
                <CardTitle className="font-headline text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-6 text-left">
                 <div>
                    <span className="font-headline text-4xl font-bold">
                        {plan.price !== 'Custom' ? '₹' + plan.price : 'Custom'}
                    </span>
                    <span className="text-muted-foreground">
                        {plan.price !== 'Custom' ? ' /screen/mo' : ''}
                    </span>
                 </div>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={plan.isPopular ? 'default' : 'outline'} onClick={onGetStartedClick}>
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
