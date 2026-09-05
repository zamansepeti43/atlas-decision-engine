import { BellRing, Bot, CheckSquare2, Crosshair, History, MemoryStick, Plus, Settings, Target } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAssistantState } from '@/hooks/useAssistantState';

const IZCI_ITEMS = [
  { label: 'Takipler', icon: Crosshair },
  { label: 'Görevler', icon: CheckSquare2 },
  { label: 'Hedefler', icon: Target },
];

export function AtlasSidebar() {
  const [location, navigate] = useLocation();
  const { setOpenMobile } = useSidebar();
  const state = useAssistantState();
  const unread = state.events.filter((event) => !event.read).length;

  const goTo = (path: string) => {
    navigate(path);
    setOpenMobile(false);
  };
  const openIzci = () => goTo('/izci');
  const newConversation = () => {
    goTo('/');
    window.dispatchEvent(new Event('atlas-new-conversation'));
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg object-contain" />
          <div><p className="font-serif text-lg font-bold">Atlas <span className="text-primary">AI</span></p><p className="text-xs text-muted-foreground">Kişisel yapay zeka asistanı</p></div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Çalışma alanı</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton isActive={location === '/'} onClick={() => goTo('/')} tooltip="Atlas"><Bot /><span>Atlas</span></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton onClick={newConversation} tooltip="Yeni sohbet"><Plus /><span>Yeni Sohbet</span></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton disabled tooltip="Geçmiş"><History /><span>Geçmiş</span></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton disabled tooltip="Hafıza"><MemoryStick /><span>Hafıza</span></SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>İzci</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={location === '/izci'} onClick={openIzci} tooltip="İzci">
                  <BellRing /><span>İZCİ</span>
                </SidebarMenuButton>
                {unread > 0 && <SidebarMenuBadge>{unread}</SidebarMenuBadge>}
              </SidebarMenuItem>
              {IZCI_ITEMS.map(({ label, icon: Icon }) => (
                <SidebarMenuItem key={label}><SidebarMenuButton onClick={openIzci} tooltip={label}><Icon /><span>{label}</span></SidebarMenuButton></SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu><SidebarMenuItem><SidebarMenuButton disabled tooltip="Ayarlar"><Settings /><span>Ayarlar</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
