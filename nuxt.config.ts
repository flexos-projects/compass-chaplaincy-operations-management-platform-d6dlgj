export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    'nuxt-vuefire',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/google-fonts'
  ],

  vuefire: {
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID
    },
    admin: {
      serviceAccount: process.env.NUXT_FIREBASE_ADMIN_SERVICE_ACCOUNT
    }
  },

  googleFonts: {
    families: {
      Inter: [400, 500, 600]
    }
  },

  typescript: {
    strict: true,
    typeCheck: true
  }
})
