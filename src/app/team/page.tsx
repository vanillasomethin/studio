'use client';

import Header from '@/components/sections/header';
import Footer from '@/components/sections/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Linkedin, Mail } from 'lucide-react';

const coreTeam = [
  {
    name: 'Ar. Zeba Ali Khan',
    role: 'Co-Founder & Architect',
    description: 'Visionary Co-Founder and Architect at Vanilla and Somethin\', driving entrepreneurial ventures in architectural design and project management. Passionate about building innovative solutions and leading impactful projects from concept to completion.',
    image: '/team-zeba.jpg',
  },
  {
    name: 'Ar. Hisham Khalid Abdul Kareem',
    role: 'Co-Founder & Architect',
    description: 'Forward-thinking Architect at Western International with a keen interest in entrepreneurial opportunities. Proven ability to manage architectural design projects and a drive to explore new business ventures within the industry.',
    image: '/team-hisham.jpg',
  },
];

const supportingTeam = [
  {
    name: 'Er. Mohammed Asfaq',
    role: 'Engineering & Operations',
    description: 'Entrepreneurial executive with multi-functional experience in health-related industries (USA, Canada, Africa, India) seeking business development and startup opportunities.',
  },
  {
    name: 'Er. Zoya Sayeedunissa',
    role: 'Marketing & Strategy',
    description: 'Marketing Professional with 5+ years in international marketing, sales, sourcing, and brand management. Expertise in cost reduction and sales growth.',
  },
  {
    name: 'Er. Faraz Ahmed',
    role: 'Engineering & Innovation',
    description: 'Engineer with strong problem-solving and operational skills. Applies abilities in innovative projects and explores entrepreneurial paths within a team setting.',
  },
  {
    name: 'Er. Saad Ali Khan',
    role: 'Technical Operations',
    description: 'Onsite technical expert in electrical systems, project coordination, and maintenance. Provides hands-on troubleshooting in industrial and domestic settings.',
  },
];

export default function TeamPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header onGetStartedClick={() => {}} />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-headline text-4xl font-bold tracking-tight sm:text-6xl mb-6">
              Meet the <span className="text-primary">Team</span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Passionate professionals united by a vision to transform retail media in India
            </p>
          </div>
        </section>

        {/* Core Team */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-primary">
                Core Team
              </h2>
            </div>

            <div className="grid gap-12 md:grid-cols-2 max-w-5xl mx-auto">
              {coreTeam.map((member) => (
                <Card key={member.name} className="overflow-hidden hover:shadow-xl transition-shadow border-primary/20">
                  <CardContent className="p-8">
                    <div className="text-center mb-6">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-4 flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary">
                          {member.name.split(' ')[1][0]}{member.name.split(' ')[2][0]}
                        </span>
                      </div>
                      <h3 className="font-headline text-2xl font-bold mb-2">
                        {member.name}
                      </h3>
                      <p className="text-primary font-semibold mb-4">{member.role}</p>
                    </div>
                    <p className="text-muted-foreground text-center leading-relaxed">
                      {member.description}
                    </p>
                    <div className="flex justify-center gap-4 mt-6">
                      <button className="text-primary hover:text-primary/80 transition-colors">
                        <Linkedin className="h-5 w-5" />
                      </button>
                      <button className="text-primary hover:text-primary/80 transition-colors">
                        <Mail className="h-5 w-5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Supporting Team */}
        <section className="bg-secondary/30 py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4 text-primary">
                Supporting Team Members
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
              {supportingTeam.map((member) => (
                <Card key={member.name} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="text-center mb-4">
                      <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">
                          {member.name.split(' ')[1][0]}
                        </span>
                      </div>
                      <h3 className="font-headline text-lg font-bold mb-1">
                        {member.name}
                      </h3>
                      <p className="text-sm text-primary font-semibold mb-3">{member.role}</p>
                    </div>
                    <p className="text-sm text-muted-foreground text-center leading-relaxed">
                      {member.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Join Us CTA */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-6">
              Join Our Growing Team
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-8">
              We're always looking for talented individuals who share our passion for innovation
            </p>
            <a href="/careers" className="inline-block bg-primary text-white px-8 py-4 rounded-lg font-bold hover:bg-primary/90 transition-colors">
              View Open Positions
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
