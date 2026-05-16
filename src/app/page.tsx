'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';

/* ─── Types ─── */
type HeroState = 'brand' | 'kirana' | 'consumer';

const HERO_STATES: { state: HeroState; img: string; cap: string; loc: string; corner: string; icon: string; audience: string; label: string }[] = [
  { state: 'brand',    img: '/for-brands.jpg',          cap: 'Reach the shelf, not the feed.',     loc: 'Mumbai · BKC',         corner: 'N°01 · Brand',    icon: '□', audience: 'Audience 01', label: 'Join as a Brand' },
  { state: 'kirana',   img: '/kirana-best-practice.jpg', cap: 'Earn more from your shelves.',       loc: 'Attavar · Mangalore',  corner: 'N°02 · Kirana',   icon: '◫', audience: 'Audience 02', label: 'Partner as a Kirana' },
  { state: 'consumer', img: '/india-street.jpg',         cap: 'Discover your next favorite.',       loc: 'Lajpat Nagar · Delhi', corner: 'N°03 · Consumer', icon: '◈', audience: 'Audience 03', label: 'Get Deals as a Consumer' },
];

const CITIES = [
  { name: 'Delhi', live: false },
  { name: 'Mumbai', live: true },
  { name: 'Bengaluru', live: false },
  { name: 'Chennai', live: false },
  { name: 'Hyderabad', live: true },
  { name: 'Pune', live: false },
  { name: 'Kolkata', live: false },
  { name: 'Ahmedabad', live: false },
  { name: 'Mangalore', live: true },
  { name: 'Jaipur', live: false },
  { name: 'Lucknow', live: false },
  { name: 'Indore', live: false },
  { name: 'Coimbatore', live: true },
  { name: 'Kochi', live: false },
  { name: 'Mysore', live: false },
  { name: 'Nagpur', live: false },
  { name: 'Surat', live: false },
  { name: 'Goa', live: true },
];

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [onDark, setOnDark] = useState(false);
  const [vcount, setVcount] = useState('00.00 %');
  const [hovering, setHovering] = useState(false);
  const [heroState, setHeroState] = useState<HeroState>('brand');

  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const joinRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoIdxRef = useRef(0);

  /* ─── Loader ─── */
  useEffect(() => {
    const t = setTimeout(() => { setLoaded(true); setTimeout(() => setReady(true), 50); }, 1400);
    return () => clearTimeout(t);
  }, []);

  /* ─── Custom cursor ─── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (cursorDotRef.current) cursorDotRef.current.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    };
    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (cursorRingRef.current) cursorRingRef.current.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    loop();
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  /* ─── Scroll ─── */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      const max = document.body.scrollHeight - window.innerHeight;
      const pct = Math.min(1, y / max);
      setVcount(`${(pct * 100).toFixed(2).padStart(5, '0')} %`);
      let dark = false;
      [joinRef.current, footerRef.current].forEach(sec => {
        if (!sec) return;
        const r = sec.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.2) dark = true;
      });
      setOnDark(dark);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ─── IntersectionObserver for reveal / fade ─── */
  useEffect(() => {
    if (!ready) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal, .fade').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [ready]);

  /* ─── Hero auto-cycle ─── */
  const states: HeroState[] = ['brand', 'kirana', 'consumer'];
  const startAuto = useCallback(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    autoTimerRef.current = setInterval(() => {
      autoIdxRef.current = (autoIdxRef.current + 1) % states.length;
      setHeroState(states[autoIdxRef.current]);
    }, 3200);
  }, []);
  const stopAuto = useCallback(() => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); }, []);
  const resetIdle = useCallback(() => {
    stopAuto();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(startAuto, 4000);
  }, [startAuto, stopAuto]);
  useEffect(() => { resetIdle(); return () => { stopAuto(); if (idleTimerRef.current) clearTimeout(idleTimerRef.current); }; }, [resetIdle, stopAuto]);

  const activeHero = HERO_STATES.find(h => h.state === heroState)!;

  return (
    <>

      {/* Cursor */}
      <div
        ref={cursorDotRef}
        className={`cursor${hovering ? ' hovering' : ''}`}
        style={{ position: 'fixed', top: 0, left: 0 }}
      />
      <div
        ref={cursorRingRef}
        className={`cursor-ring`}
        style={{ position: 'fixed', top: 0, left: 0 }}
      />

      <div className={`${hovering ? 'hovering' : ''} ${onDark ? 'on-dark' : ''} ${ready ? 'ready' : ''}`}
           style={{ display: 'contents' }}>

      {/* Loader */}
      <div className={`loader${loaded ? ' done' : ''}`} id="loader">
        <div className="loader-inner">
          <div className="loader-mark">alive<span className="dot" /></div>
          <div className="loader-num">In-store · MMXXVI · Network 027</div>
          <div className="loader-bar" />
        </div>
      </div>

      {/* Nav */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <a href="#" className="brand">alive<span className="dot" /></a>
        <ul>
          {[['#story','Story'],['#audiences','Audiences'],['#how','How It Works'],['#proof','Proof'],['#voices','Voices']].map(([href,lbl]) => (
            <li key={href}><a href={href}>{lbl}</a></li>
          ))}
        </ul>
        <a href="#join" className="cta"><span className="cta-dot" />Get Started</a>
      </nav>

      {/* Vrail */}
      <div className={`vrail${onDark ? ' on-dark' : ''}`} aria-hidden="true">
        <div className="vlabel">In-Store · India · Live</div>
        <div className="vline" />
        <div className="vcount">{vcount}</div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-eyebrow">
          <div className="l">In-Store Digital Network<br />Est. 2026 · India · Live Now</div>
          <div className="r">A new retail media channel built inside India's neighbourhood kirana shops — where 76% of purchase decisions are still made.</div>
        </div>

        <div className="hero-grid">
          <div className="hero-left">
            <h1>
              <span className="line"><span className="word"><span className="red">Seen.</span></span></span>
              <span className="line"><span className="word">Remembered.</span></span>
              <span className="line"><span className="word">Bought.</span></span>
            </h1>

            <div
              className="hero-ctas"
              onMouseEnter={stopAuto}
              onMouseLeave={resetIdle}
            >
              {HERO_STATES.map((h, i) => (
                <a
                  key={h.state}
                  href="#"
                  className={`hctabtn${heroState === h.state ? ' is-active' : ''}`}
                  onMouseEnter={() => setHeroState(h.state)}
                  onFocus={() => setHeroState(h.state)}
                  onClick={e => e.preventDefault()}
                >
                  <div className="hctabtn-left">
                    <span className="ico">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        {i === 0 && <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></>}
                        {i === 1 && <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}
                        {i === 2 && <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>}
                      </svg>
                    </span>
                    <span className="lbl">
                      <span className="sub">{h.audience}</span>
                      {h.label}
                    </span>
                  </div>
                  <span className="hctabtn-num">N°0{i + 1}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Alive screen device */}
          <div className="alive-screen">
            <div className="screen">
              {HERO_STATES.map(h => (
                <div key={h.state} className={`layer${heroState === h.state ? ' is-active' : ''}`}>
                  <Image src={h.img} alt={h.label} fill style={{ objectFit: 'cover' }} sizes="360px" priority={h.state === 'brand'} />
                </div>
              ))}
              <div className="corner">{activeHero.corner}</div>
              <div className="cap">
                <span className="loc">{activeHero.loc}</span>
                {activeHero.cap}
              </div>
              <div className="alive-tag"><span className="dot" />alive</div>
            </div>
          </div>
        </div>

        <div className="hero-footrow">
          <div className="cell"><div className="label">Plays per day</div><div className="value"><span className="num">~144</span>per screen, 7 AM to 9 PM</div></div>
          <div className="cell"><div className="label">Sales lift</div><div className="value"><span className="num">+20<em>%</em></span>average pilot uplift</div></div>
          <div className="cell"><div className="label">Brand recall</div><div className="value"><span className="num">74<em>%</em></span>vs 29% traditional</div></div>
        </div>
      </section>

      {/* STORY */}
      <section className="philosophy" id="story">
        <div className="sec-h">
          <div className="idx">01 / Our Story</div>
          <div className="lbl">The Bridge</div>
        </div>
        <div className="philosophy-grid">
          <div>
            <h2 className="fade">We saw <span className="lite">disconnected</span><br />players in a<br /><span className="red">single</span> ecosystem.<br />So we built<br />the bridge.</h2>
            <div className="sig">— Founding Note · AliveNow · 2026</div>
          </div>
          <div>
            <p className="lede fade">India shops in person. Twelve million kiranas still anchor every neighbourhood, and three out of four purchase decisions happen at the shelf — not on a feed. The market knew this. The brands did not have a way to reach it.</p>
            <p className="lede fade">Alive places a small digital screen above the counter of every partner kirana. Brands run 8-second plays. Kirana owners earn a share. Consumers discover what's worth trying — right where they're already deciding.</p>
            <div className="img-wrap reveal" style={{ aspectRatio: '3/2', marginTop: 56 }}>
              <Image src="/alive-product-shot.png" alt="Alive in-store screen above counter" fill style={{ objectFit: 'cover' }} sizes="50vw" />
              <div className="badge"><span className="dot" />Live · Attavar, Mangalore</div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-wrap">
        <div className="marquee">
          <span>Parle <span className="star">●</span> Britannia <span className="star">●</span> <span className="out">Amul</span> <span className="star">●</span> Dabur <span className="star">●</span> ITC <span className="star">●</span> <span className="out">Tata Consumer</span> <span className="star">●</span> Marico <span className="star">●</span> Nestlé <span className="star">●</span> Parle <span className="star">●</span> Britannia <span className="star">●</span> <span className="out">Amul</span> <span className="star">●</span> Dabur <span className="star">●</span> ITC <span className="star">●</span> <span className="out">Tata Consumer</span> <span className="star">●</span> Marico <span className="star">●</span> Nestlé <span className="star">●</span></span>
        </div>
      </div>

      {/* AUDIENCES */}
      <section className="vessels" id="audiences">
        <div className="sec-h">
          <div className="idx">02 / The Ecosystem</div>
          <div className="lbl">Three Audiences</div>
        </div>
        <div className="vessels-grid">
          {[
            { img: '/for-brands.jpg',          tag: 'Audience 01', title: 'Reach the shelf,', em: 'not the feed.', desc: 'Launch in-store campaigns in three steps. Pay for plays. Measure by uplift, not impressions.', num: 'N°01', icon: 'Package', alt: '' },
            { img: '/kirana-shop.jpg',          tag: 'Audience 02', title: 'Earn more from', em: 'your shelves.',  desc: 'One screen. Zero investment. A new monthly revenue stream paid in cash or stock credit.',       num: 'N°02', icon: 'Store',   alt: '' },
            { img: '/india-street.jpg',         tag: 'Audience 03', title: 'Discover your',  em: 'next favorite.', desc: 'Relevant. Hyper-local. Already in stock. No tracking, no scrolling — just a play above the counter.', num: 'N°03', icon: 'Bag',     alt: '' },
          ].map((v, i) => (
            <article key={v.tag} className="vessel">
              <div className="pic img-wrap reveal" style={{ aspectRatio: '4/5', position: 'relative' }}>
                <Image src={v.img} alt={v.alt} fill style={{ objectFit: 'cover' }} sizes="33vw" />
                <div className="pic-cta">{v.icon} {v.tag.replace('Audience ','For ').replace('01','Brands').replace('02','Kiranas').replace('03','Consumers')}</div>
              </div>
              <div className="meta">
                <div className="name">
                  <span className="tag">{v.tag}</span>
                  {v.title} <em>{v.em}</em>
                  <p>{v.desc}</p>
                </div>
                <div className="num">{v.num}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="benefits" id="how">
        <div className="sec-h">
          <div className="idx">03 / How It Works</div>
          <div className="lbl">The Five Acts</div>
        </div>
        <div className="benefits-head">
          <h2 className="fade"><span className="red">Launch</span><br />in three<br />simple steps. <span className="lite">Measure</span><br />in one.</h2>
          <p className="fade">Every campaign moves through the same stages — onboarded once, run weekly, attributed monthly. Built for FMCG launches, regional rollouts, and category-share fights at the shelf.</p>
        </div>
        <ul className="blist">
          {[
            { n:'01', tag:'Onboard', title:'Upload your creative.',  desc:'8-second portrait MP4 or a still. Auto-resized, auto-localised in 11 languages. Live in 48 hours.' },
            { n:'02', tag:'Target',  title:'Pick your geography.',   desc:'Filter by city, neighbourhood, kirana category, even monthly footfall. Down to a single PIN code.' },
            { n:'03', tag:'Run',     title:'Plays start the same day.', desc:'Up to 144 plays per screen per day, between 7 AM and 9 PM. Pause, swap, or A/B a creative live.' },
            { n:'04', tag:'Measure', title:'Uplift, not impressions.', desc:'Weekly sales-lift report against a control set of matched kiranas. Pay only for verified plays.' },
            { n:'05', tag:'Reinvest',title:'Compound the winners.',  desc:'Push budget toward the SKUs and PIN codes where the lift was largest. Re-run in one click.' },
          ].map(b => (
            <li key={b.n}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}>
              <span className="b-num">{b.n}</span>
              <span className="b-title"><span className="tag">{b.tag}</span>{b.title}</span>
              <span className="b-desc">{b.desc}</span>
              <span className="b-mark" />
            </li>
          ))}
        </ul>
      </section>

      {/* PROOF */}
      <div className="proof" id="proof">
        <div className="proof-head">
          <h2 className="fade">Quantifiably <span className="red">better</span><br />than passive media.</h2>
          <p className="fade">Independent measurement across 412 pilot stores, six FMCG categories, twelve weeks. Reported by a third-party retail analytics partner.</p>
        </div>
        <div className="proof-grid">
          {[
            { n: '+20', u: '%', l: 'Average sales lift', s: 'across the pilot cohort' },
            { n: '2',   u: '×', l: 'Stock movement velocity', s: 'vs. non-Alive shelves' },
            { n: '74',  u: '%', l: 'Aided brand recall', s: 'vs. 29% on print & OOH' },
            { n: '4,320',u: '',  l: 'Monthly views per screen', s: 'at the point of purchase' },
          ].map(s => (
            <div key={s.l} className="stat">
              <div className="n">{s.n}{s.u && <span className="u">{s.u}</span>}</div>
              <div className="l">{s.l}<span>{s.s}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* VOICES */}
      <section className="stewards" id="voices">
        <div className="sec-h">
          <div className="idx">04 / Voices</div>
          <div className="lbl">Loved by the Ecosystem</div>
        </div>
        <div className="stewards-grid">
          {[
            { img: '/kirana-best-practice.jpg', quote: 'My shop earned ₹6,400 last month doing nothing extra. The screen runs. The customers watch. I count the cash.', nm: 'Ramesh Kumar', role: 'Kirana Owner · Lajpat Nagar' },
            { img: '/store-shelf.jpg',          quote: "We moved the launch SKU two times faster in Alive pincodes. The control set didn't budge. That's the cleanest read we've had in years.", nm: 'Priya Menon', role: 'Brand Manager · FMCG Top-10' },
            { img: '/store-aisle.jpg',          quote: "I saw the chai mix on the screen above Suresh's counter. Picked it up the same trip. Honestly, better than scrolling Instagram.", nm: 'Aanya Sharma', role: 'Shopper · Bengaluru' },
            { img: '/alive-after.png',          quote: 'Onboarding the kirana took fifteen minutes. The hardware came in a single box. The first play went live the next morning.', nm: 'Vikram Patel', role: 'Field Lead · Alive Network' },
          ].map(t => (
            <article key={t.nm} className="steward">
              <div className="pic img-wrap reveal" style={{ position: 'relative' }}>
                <Image src={t.img} alt="" fill style={{ objectFit: 'cover' }} sizes="25vw" />
              </div>
              <p className="quote">{t.quote}</p>
              <div className="who">
                <div className="nm">{t.nm}</div>
                <div className="role">{t.role}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* JOIN */}
      <section className="join" id="join" ref={joinRef}>
        <h2>
          Be <span className="red">Alive</span><span className="hdot" /><br />
          <span className="out">with us.</span>
        </h2>
        <div className="row">
          <p>Brands ship pilots in two weeks. Kiranas onboard in fifteen minutes. The 2026 network expands across every major Indian city by Q4 — join now, lock the geography.</p>
          <a
            href="#"
            className="magnet"
            onClick={e => e.preventDefault()}
            onMouseMove={e => {
              const el = e.currentTarget;
              const r = el.getBoundingClientRect();
              const x = e.clientX - (r.left + r.width / 2);
              const y = e.clientY - (r.top + r.height / 2);
              el.style.transform = `translate(${x * 0.25}px,${y * 0.4}px)`;
            }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
          >
            <span className="dot" />Get Started
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="f" ref={footerRef}>
        <div className="top">
          <div className="lead">
            <h3>alive<span className="dot" /></h3>
            <div className="tagline">Turning kirana visits into discovery moments. Twelve million shelves. One network.</div>
            <a href="#join" className="footer-cta"><span className="dot" />Be Alive With Us</a>
          </div>
          <div className="col">
            <h4>Product</h4>
            <ul>
              {['For Brands','For Kiranas','For Consumers','Measurement','How It Works'].map(l => <li key={l}><a href="#">{l}</a></li>)}
            </ul>
          </div>
          <div className="col">
            <h4>Company</h4>
            <ul>
              {['Our Story','Press','Careers','Contact Sales','Partners'].map(l => <li key={l}><a href="#">{l}</a></li>)}
            </ul>
          </div>
          <div className="col">
            <h4>Reach Us</h4>
            <p><strong>hello@aliveindia.in</strong>For brand & press enquiries</p>
            <p style={{ marginTop: 14 }}><strong>+91 22 4000 0000</strong>Mon–Sat · 10 AM to 7 PM IST</p>
            <p style={{ marginTop: 14 }}><strong>HQ · Mumbai</strong>Bandra Kurla Complex<br />Mumbai 400 051</p>
          </div>
        </div>

        <div className="ticker">
          <div className="track">
            {[...CITIES, ...CITIES].map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="tdot">●</span>}
                <span className={c.live ? 'city-live' : ''}>{c.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="bot">
          <div>© MMXXVI · Alive Networks Pvt. Ltd.</div>
          <div className="mid">Live across India · 11 languages</div>
          <div className="end">
            <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Instagram</a><a href="#">LinkedIn</a>
          </div>
        </div>

        <div className="mega" aria-hidden="true">
          <span className="word">alive<span className="megadot" /></span>
        </div>
      </footer>

      </div>
    </>
  );
}