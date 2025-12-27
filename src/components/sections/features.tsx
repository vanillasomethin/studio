import AliveMeter from "../interactive/alive-meter";
import DataPulse from "../interactive/data-pulse";
import ImpactCalculator from "../interactive/impact-calculator";
import KiranaStoreExplorer from "../interactive/kirana-store-explorer";
import AliveBeforeAfter from "../interactive/alive-before-after";

export default function Features() {
  return (
    <section id="features" className="bg-background">
      <div className="container mx-auto space-y-32 px-4">
        <div className="text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">
                Experience Alive in Action
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Interact with our tools to see how we're revolutionizing retail media.
            </p>
        </div>
        
        <AliveBeforeAfter />
        <KiranaStoreExplorer />
        <ImpactCalculator />
        <DataPulse />
        <AliveMeter />
      </div>
    </section>
  );
}
