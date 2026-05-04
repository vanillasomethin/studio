const brands = [
  'Parle', 'Britannia', 'Amul', 'ITC', 'Nestlé',
  'Dutch Corner', 'Campco', 'Landtrades', 'Hayyatibb',
  'Tecfides', 'Marian Builders', 'Fern', 'Kerepedals', 'Kissa',
];

const doubled = [...brands, ...brands];

export default function Brands() {
  return (
    <section className="border-y border-border bg-white py-10">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-8">
        Trusted by India's most innovative brands
      </p>
      <div
        className="flex overflow-hidden"
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
          maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div className="flex shrink-0" style={{ animation: 'scroll 32s linear infinite' }}>
          {doubled.map((brand, i) => (
            <span key={i} className="flex items-center gap-0">
              <span className="whitespace-nowrap px-7 text-[13px] font-semibold tracking-widest text-foreground/40 uppercase transition-colors duration-300 hover:text-foreground/80">
                {brand}
              </span>
              <span className="h-[3px] w-[3px] rounded-full bg-border/60 flex-shrink-0" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
