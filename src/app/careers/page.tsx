'use client';

import Header from '@/components/sections/header';
import Footer from '@/components/sections/footer';
import { Briefcase, MapPin, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const jobOpenings = [
  {
    title: 'Senior Full-Stack Engineer',
    department: 'Engineering',
    location: 'Bangalore / Remote',
    type: 'Full-time',
    description: 'Build scalable systems for retail media platform serving thousands of stores across India.',
  },
  {
    title: 'Business Development Manager',
    department: 'Sales',
    location: 'Mumbai',
    type: 'Full-time',
    description: 'Drive partnerships with brands and expand our network of kirana stores.',
  },
  {
    title: 'Product Designer',
    department: 'Design',
    location: 'Remote',
    type: 'Full-time',
    description: 'Create intuitive experiences for brands, store owners, and consumers.',
  },
  {
    title: 'Marketing Manager',
    department: 'Marketing',
    location: 'Bangalore',
    type: 'Full-time',
    description: 'Lead marketing initiatives and build brand awareness in the retail media space.',
  },
];

const benefits = [
  'Competitive salary and equity',
  'Flexible work arrangements',
  'Health insurance',
  'Learning & development budget',
  'Team outings and events',
  'Impact-driven work culture',
];

export default function CareersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header onGetStartedClick={() => {}} />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-headline text-4xl font-bold tracking-tight sm:text-6xl mb-6">
              Build the Future of <span className="text-primary">Retail Media</span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Join our mission to transform how brands connect with customers at the most crucial moment—right where purchase decisions happen.
            </p>
          </div>
        </section>

        {/* Why Join Alive */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Why Join Alive?
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Be part of a team that's revolutionizing retail media in India
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              {benefits.map((benefit) => (
                <Card key={benefit} className="border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="text-primary text-2xl">✓</div>
                      <p className="font-medium">{benefit}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Open Positions */}
        <section className="bg-secondary/30 py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Open Positions
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Find your next opportunity with us
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
              {jobOpenings.map((job) => (
                <Card key={job.title} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <CardTitle className="text-2xl mb-2">{job.title}</CardTitle>
                        <CardDescription className="text-base">
                          {job.description}
                        </CardDescription>
                      </div>
                      <Button className="whitespace-nowrap">
                        Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {job.department}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {job.type}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-6">
              Don't See a Perfect Fit?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-8">
              We're always looking for talented individuals. Send us your resume and we'll keep you in mind for future opportunities.
            </p>
            <Button size="lg" className="text-lg px-8">
              Send Your Resume
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
