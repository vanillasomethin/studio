import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'ALIVE Partner',
    short_name:       'ALIVE',
    description:      'ALIVE Store Partner — manage offers, billing, and earnings',
    start_url:        '/store-dashboard',
    scope:            '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#ffffff',
    theme_color:      '#ef4444',
    categories:       ['business', 'finance'],
    icons: [
      {
        src:     '/icons/icon-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-maskable-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',
      },
      {
        src:     '/icons/icon-maskable-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
      // SVG fallback for browsers that support it
      {
        src:     '/favicon.svg',
        sizes:   'any',
        type:    'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name:       'Add offer',
        short_name: 'Offers',
        url:        '/store-dashboard#offers',
        description: 'Add a new product offer',
      },
      {
        name:       'Voice bill',
        short_name: 'Bill',
        url:        '/store-dashboard#voicebill',
        description: 'Create a bill using voice',
      },
    ],
  };
}
