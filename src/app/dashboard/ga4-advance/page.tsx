import { Ga4AdvanceDashboard } from "@/components/ga4/Ga4AdvanceDashboard";
import { getActiveSmartGa4Clients } from "@/lib/supabase/queries/smart-ga4-config";

export default async function Ga4AdvancePage() {
  const clientConfigs = await getActiveSmartGa4Clients();

  return <Ga4AdvanceDashboard clientConfigs={clientConfigs} />;
}
