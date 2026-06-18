import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

interface Offer {
  productName: string;
  productImageUrl: string;
  mrp: number | string;
  discountPercent: number;
  offerPrice: number | string;
}

interface FlyerData {
  brandLogoUrl: string;
  headerTitle: string;
  headerDate: string;
  headerBadgeText: string;
  storeName: string;
  footerLine1: string;
  footerLine2: string;
  contactWebsite: string;
  contactPhone: string;
  qrCodeUrl: string;
  offers: Offer[]; // exactly 9
}

/** Parse headerBadgeText for a \d+% pattern and return parts */
function parseBadgeText(text: string): {
  before: string;
  percent: string;
  after: string;
  matched: boolean;
} {
  const match = text.match(/^([\s\S]*?)(\d+%)([\s\S]*)$/);
  if (match) {
    return {
      before: match[1].trim(),
      percent: match[2].trim(),
      after: match[3].trim(),
      matched: true,
    };
  }
  return { before: text, percent: '', after: '', matched: false };
}

/** Split headerTitle words into two roughly-equal lines */
function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) return [words[0] ?? '', ''];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

// "alive" wordmark + red dot — mirrors src/components/icons/logo.tsx, rendered inline so
// no logo image file is needed (Satori can't load custom webfonts without a fetch, so this
// uses the flyer's existing sans-serif rather than Poppins).
function AliveLogo({ size = 34 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{ fontSize: size, fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1 }}>
        alive
      </span>
      <div style={{
        width: size * 0.16, height: size * 0.16, borderRadius: '50%', backgroundColor: '#dc2626',
        marginLeft: size * 0.06, transform: `translateY(${size * 0.02}px)`,
      }} />
    </div>
  );
}

function FlyerImage({ data }: { data: FlyerData }) {
  const badge = parseBadgeText(data.headerBadgeText);
  const [titleLine1, titleLine2] = splitTitle(data.headerTitle);

  // Pad offers to 9
  const offers: Offer[] = [...data.offers];
  while (offers.length < 9) {
    offers.push({
      productName: '',
      productImageUrl: '',
      mrp: 0,
      discountPercent: 0,
      offerPrice: 0,
    });
  }
  const displayOffers = offers.slice(0, 9);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 1080,
        height: 1920,
        backgroundColor: '#0f0f0f',
        fontFamily: 'sans-serif',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 28px 0 28px',
          height: 450,
          flexShrink: 0,
        }}
      >
        {/* Row A: logo + discount badge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          {/* Brand logo — custom URL if provided, else the ALIVE wordmark */}
          <div style={{ width: 140, height: 50, display: 'flex', alignItems: 'center' }}>
            {data.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.brandLogoUrl}
                width={140}
                height={50}
                style={{ objectFit: 'contain' }}
                alt="brand logo"
              />
            ) : (
              <AliveLogo />
            )}
          </div>

          {/* Discount badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#dc2626',
              borderRadius: 16,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              minWidth: 160,
            }}
          >
            {badge.matched ? (
              <>
                {badge.before ? (
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      lineHeight: 1.2,
                    }}
                  >
                    {badge.before}
                  </span>
                ) : null}
                <span
                  style={{
                    fontSize: 72,
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1,
                  }}
                >
                  {badge.percent}
                </span>
                {badge.after ? (
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: '#ffffff',
                      letterSpacing: '0.06em',
                      lineHeight: 1.2,
                    }}
                  >
                    {badge.after}
                  </span>
                ) : null}
              </>
            ) : (
              <span
                style={{ fontSize: 26, fontWeight: 800, color: '#ffffff' }}
              >
                {data.headerBadgeText}
              </span>
            )}
          </div>
        </div>

        {/* Row B: WOW + header title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 190,
              fontWeight: 900,
              color: '#dc2626',
              lineHeight: 0.85,
              marginRight: 16,
            }}
          >
            WOW
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              paddingBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 60,
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.05,
              }}
            >
              {titleLine1}
            </span>
            {titleLine2 ? (
              <span
                style={{
                  fontSize: 60,
                  fontWeight: 900,
                  color: '#ffffff',
                  lineHeight: 1.05,
                }}
              >
                {titleLine2}
              </span>
            ) : null}
          </div>
        </div>

        {/* Row C: divider / edition + date + storeName */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #333333',
            paddingTop: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#9ca3af',
                fontWeight: 600,
              }}
            >
              MANGALURU EDITION
            </span>
            {data.storeName ? (
              <span
                style={{
                  fontSize: 13,
                  color: '#9ca3af',
                  marginTop: 2,
                }}
              >
                {data.storeName}
              </span>
            ) : null}
          </div>
          <span
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {data.headerDate}
          </span>
        </div>
      </div>

      {/* ── PRODUCT GRID ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          flex: 1,
          padding: 12,
          gap: 8,
          alignContent: 'flex-start',
        }}
      >
        {displayOffers.map((offer, i) => {
          const mrpNum =
            typeof offer.mrp === 'string' ? parseFloat(offer.mrp) : offer.mrp;
          const offerPriceNum =
            typeof offer.offerPrice === 'string'
              ? parseFloat(offer.offerPrice)
              : offer.offerPrice;
          const hasDiscount =
            offer.discountPercent != null && offer.discountPercent > 0;
          const hasMrp = !isNaN(mrpNum) && mrpNum > 0;
          const hasPrice = !isNaN(offerPriceNum) && offerPriceNum > 0;

          return (
            <div
              key={i}
              style={{
                width: 346,
                backgroundColor: '#1e1e1e',
                borderRadius: 20,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 20,
                paddingBottom: 16,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Discount circle badge */}
              {hasDiscount ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    backgroundColor: '#dc2626',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: '#ffffff',
                      lineHeight: 1,
                    }}
                  >
                    {offer.discountPercent}%
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#ffffff',
                      lineHeight: 1,
                    }}
                  >
                    OFF
                  </span>
                </div>
              ) : null}

              {/* Product image */}
              {offer.productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={offer.productImageUrl}
                  width={200}
                  height={185}
                  style={{ objectFit: 'contain', marginTop: 8 }}
                  alt={offer.productName}
                />
              ) : null}

              {/* MRP */}
              {hasMrp ? (
                <span
                  style={{
                    textDecoration: 'line-through',
                    color: '#6b7280',
                    fontSize: 17,
                    marginTop: 8,
                  }}
                >
                  ₹{mrpNum}
                </span>
              ) : null}

              {/* Offer price badge */}
              {hasPrice ? (
                <div
                  style={{
                    backgroundColor: '#dc2626',
                    borderRadius: 12,
                    width: '90%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 6,
                    paddingBottom: 6,
                    marginTop: hasMrp ? 4 : 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    ₹{offerPriceNum}
                  </span>
                </div>
              ) : null}

              {/* Product name */}
              {offer.productName ? (
                <span
                  style={{
                    color: '#ffffff',
                    fontSize: 15,
                    fontWeight: 600,
                    textAlign: 'center',
                    lineHeight: 1.35,
                    marginTop: 10,
                  }}
                >
                  {offer.productName}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── FOOTER ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0f0f0f',
          borderTop: '1px solid #222222',
          height: 200,
          flexShrink: 0,
          paddingLeft: 28,
          paddingRight: 28,
        }}
      >
        {/* Left column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            marginRight: 20,
          }}
        >
          <span
            style={{
              fontSize: 19,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '0.04em',
              lineHeight: 1.2,
            }}
          >
            {data.footerLine1}
          </span>
          <span
            style={{
              fontSize: 14,
              color: '#9ca3af',
              marginTop: 4,
              lineHeight: 1.3,
            }}
          >
            {data.footerLine2}
          </span>
          <span
            style={{
              fontSize: 17,
              color: '#9ca3af',
              marginTop: 14,
            }}
          >
            {data.contactWebsite}
            {data.contactWebsite && data.contactPhone ? ' | ' : ''}
            {data.contactPhone}
          </span>
        </div>

        {/* Right: QR code */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {data.qrCodeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.qrCodeUrl}
              width={118}
              height={118}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 8,
                padding: 6,
              }}
              alt="QR code"
            />
          ) : null}
          <span
            style={{
              fontSize: 10,
              color: '#9ca3af',
              maxWidth: 118,
              textAlign: 'center',
              marginTop: 6,
              lineHeight: 1.3,
            }}
          >
            SCAN HERE TO GET ALL DEALS IN A STORE NEAR YOU.
          </span>
        </div>
      </div>
    </div>
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FlyerData;

    // Pad offers to 9
    const offers: Offer[] = Array.isArray(body.offers) ? [...body.offers] : [];
    while (offers.length < 9) {
      offers.push({
        productName: '',
        productImageUrl: '',
        mrp: 0,
        discountPercent: 0,
        offerPrice: 0,
      });
    }

    const data: FlyerData = { ...body, offers };

    return new ImageResponse(<FlyerImage data={data} />, {
      width: 1080,
      height: 1920,
    });
  } catch (err) {
    const error =
      err instanceof Error ? err.message : 'Failed to generate flyer';
    return NextResponse.json({ error }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/generate-flyer',
    method: 'POST',
    description:
      'Renders a 1080×1920 digital advertising flyer as a PNG image using next/og (Satori).',
    schema: {
      brandLogoUrl: 'string (optional) — URL to a custom brand logo image. Leave empty to show the ALIVE wordmark.',
      headerTitle: 'string — headline text (split into 2 lines)',
      headerDate: 'string — date shown in header (e.g. "25 MAY")',
      headerBadgeText:
        'string — discount badge text, e.g. "UP TO 50% OFF". A \\d+% pattern is highlighted.',
      storeName: 'string (optional) — store name shown below edition text',
      footerLine1: 'string — primary footer text (bold)',
      footerLine2: 'string — secondary footer text (muted)',
      contactWebsite: 'string — website shown in footer',
      contactPhone: 'string — phone shown in footer',
      qrCodeUrl: 'string — URL to QR code image',
      offers: {
        type: 'array',
        minItems: 1,
        maxItems: 9,
        items: {
          productName: 'string',
          productImageUrl: 'string — URL to product image (optional)',
          mrp: 'number | string — original price (0 = hide)',
          discountPercent: 'number — discount % shown in badge (0 = hide)',
          offerPrice: 'number | string — offer price (0 = hide)',
        },
      },
    },
  });
}
