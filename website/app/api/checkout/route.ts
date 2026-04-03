import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_PRICE_ID) {
      throw new Error('Missing STRIPE_PRICE_ID environment variable')
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://boughapp.com'

    const body = await request.json().catch(() => ({}))
    const locale = body.locale ?? 'en'

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/${locale}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${locale}#pricing`,
      billing_address_collection: 'auto',
      automatic_tax: {
        enabled: true,
      },
      custom_text: {
        submit: {
          message:
            'Your license key will be emailed to you immediately after payment.',
        },
      },
      locale: locale === 'de' ? 'de' : 'en',
    })

    if (!session.url) {
      throw new Error('No checkout URL returned from Stripe')
    }

    return NextResponse.json(
      { url: session.url },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'An error occurred while creating the checkout session',
      },
      { status: 500 }
    )
  }
}
