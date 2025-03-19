import { Metadata } from 'next'
import Link from 'next/link'
import CustomPackageBuilder from '../../../components/packages/CustomPackageBuilder'

export const metadata: Metadata = {
  title: 'Build Your Custom Package | MadTrips',
  description: 'Create your own custom Bitcoin-friendly travel experience in Madeira by combining activities of your choice.',
}

export default function CustomPackagePage() {
  return (
    <div id="packages" className="bg-white dark:bg-gray-900 py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h1 className="text-3xl font-bold tracking-tight text-ocean dark:text-white sm:text-4xl md:text-5xl">
            Build Your Custom Package
          </h1>
          <p className="mt-4 text-lg leading-8 text-forest/80 dark:text-gray-400">
            Combine your favorite activities to create your perfect Bitcoin-friendly Madeira experience
          </p>
        </div>

        <CustomPackageBuilder />

        <div className="mt-16 text-center">
          <p className="text-forest/70 dark:text-gray-400 mb-4">Prefer a pre-designed experience?</p>
          <Link 
            href="/packages" 
            className="inline-block rounded-md bg-ocean dark:bg-ocean/80 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-ocean/90 transition-colors"
          >
            Browse Our Featured Packages
          </Link>
        </div>
      </div>
    </div>
  )
} 