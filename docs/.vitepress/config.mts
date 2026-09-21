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
              'Desetup / uninstall',
            link:
              '/desetup'
          },
          {
            text:
              'Doctor',
            link:
              '/doctor'
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
