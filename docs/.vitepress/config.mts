import {
  defineConfig
} from 'vitepress';

export default defineConfig({
  title:
    'Yellow Jacket',

  description:
    'Developer-first HTTP regression testing.',

  base:
    '/yellow-jacket/',

  cleanUrls:
    true,

  lastUpdated:
    true,

  head: [
    [
      'link',
      {
        rel:
          'icon',
        type:
          'image/png',
        href:
          '/yellow-jacket/favicon.png'
      }
    ],
    [
      'link',
      {
        rel:
          'apple-touch-icon',
        href:
          '/yellow-jacket/apple-touch-icon.png'
      }
    ],
    [
      'meta',
      {
        name:
          'theme-color',
        content:
          '#f5b700'
      }
    ]
  ],

  themeConfig: {
    logo: {
      src:
        '/logo.png',
      alt:
        'Yellow Jacket'
    },

    nav: [
      {
        text:
          'Get started',
        link:
          '/get-started'
      },
      {
        text:
          'Configuration',
        link:
          '/configuration'
      },
      {
        text:
          'Coverage',
        link:
          '/coverage'
      }
    ],

    sidebar: [
      {
        text:
          'Guide',

        items: [
          {
            text:
              'Get started',
            link:
              '/get-started'
          },
          {
            text:
              'Configuration',
            link:
              '/configuration'
          },
          {
            text:
              'Architecture',
            link:
              '/architecture'
          },
          {
            text:
              'Desetup / uninstall',
            link:
              '/desetup'
          },
          {
            text:
              'Doctor',
            link:
              '/doctor'
          },
          {
            text:
              'Feedback & contributing',
            link:
              '/contributing'
          }
        ]
      },

      {
        text:
          'Features',

        items: [
          {
            text:
              'Scenarios',
            link:
              '/scenarios'
          },
          {
            text:
              'Test selection',
            link:
              '/selection'
          },
          {
            text:
              'Coverage',
            link:
              '/coverage'
          },
          {
            text:
              'Git hooks',
            link:
              '/git-hooks'
          }
        ]
      },

      {
        text:
          'Automation',

        items: [
          {
            text:
              'CI & reports',
            link:
              '/ci'
          },
          {
            text:
              'Troubleshooting',
            link:
              '/troubleshooting'
          }
        ]
      }
    ],

    socialLinks: [
      {
        icon:
          'github',
        link:
          'https://github.com/Loxime/yellow-jacket'
      }
    ],

    search: {
      provider:
        'local'
    },

    outline: [
      2,
      3
    ],

    editLink: {
      pattern:
        'https://github.com/Loxime/yellow-jacket/edit/main/docs/:path',

      text:
        'Edit this page on GitHub'
    },

    footer: {
      message:
        'Released under the MIT License.',

      copyright:
        'Yellow Jacket'
    }
  }
});
