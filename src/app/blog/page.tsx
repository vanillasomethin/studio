'use client';

import Header from '@/components/sections/header';
import Footer from '@/components/sections/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const blogPosts = [
  {
    title: 'The Future of Retail Media in India',
    excerpt: 'Exploring how digital advertising is transforming the traditional kirana store experience and creating new opportunities for brands.',
    author: 'Ar. Zeba Ali Khan',
    date: '2024-12-15',
    category: 'Industry Insights',
    readTime: '5 min read',
  },
  {
    title: 'Why Kirana Stores Are the Next Big Advertising Channel',
    excerpt: 'Discover why neighborhood stores represent untapped potential for brands looking to connect with consumers at the point of purchase.',
    author: 'Er. Zoya Sayeedunissa',
    date: '2024-12-10',
    category: 'Marketing',
    readTime: '7 min read',
  },
  {
    title: 'Digital Transformation of Traditional Retail',
    excerpt: 'How technology is bridging the gap between traditional retail and modern advertising, creating win-win scenarios for all stakeholders.',
    author: 'Ar. Hisham Khalid',
    date: '2024-12-05',
    category: 'Technology',
    readTime: '6 min read',
  },
  {
    title: 'Measuring ROI in Retail Media',
    excerpt: 'A comprehensive guide to tracking and measuring the impact of in-store digital advertising campaigns.',
    author: 'Er. Mohammed Asfaq',
    date: '2024-11-28',
    category: 'Analytics',
    readTime: '8 min read',
  },
  {
    title: 'Success Stories: Brands Winning with Alive',
    excerpt: 'Real-world case studies of brands that have successfully leveraged our platform to reach their target audience.',
    author: 'Ar. Zeba Ali Khan',
    date: '2024-11-20',
    category: 'Case Studies',
    readTime: '10 min read',
  },
  {
    title: 'The Psychology of Point-of-Purchase Advertising',
    excerpt: 'Understanding consumer behavior and decision-making at the critical moment of purchase in kirana stores.',
    author: 'Er. Zoya Sayeedunissa',
    date: '2024-11-15',
    category: 'Consumer Behavior',
    readTime: '6 min read',
  },
];

const categories = ['All', 'Industry Insights', 'Marketing', 'Technology', 'Analytics', 'Case Studies'];

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header onGetStartedClick={() => {}} />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-headline text-4xl font-bold tracking-tight sm:text-6xl mb-6">
              Alive <span className="text-primary">Blog</span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Insights, stories, and updates from the world of retail media
            </p>
          </div>
        </section>

        {/* Categories */}
        <section className="border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-wrap gap-3 justify-center">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={category === 'All' ? 'default' : 'outline'}
                  className="rounded-full"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Blog Posts */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
              {blogPosts.map((post) => (
                <Card key={post.title} className="hover:shadow-xl transition-shadow flex flex-col h-full">
                  <CardHeader>
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        {post.category}
                      </span>
                    </div>
                    <CardTitle className="text-xl mb-2 line-clamp-2">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end">
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span className="line-clamp-1">{post.author}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <span>{post.readTime}</span>
                      </div>
                      <Button variant="ghost" className="w-full justify-between group">
                        Read More
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="bg-secondary/30 py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Stay Updated
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-8">
              Subscribe to our newsletter for the latest insights on retail media
            </p>
            <div className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-lg border bg-background"
              />
              <Button size="lg">
                Subscribe
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
