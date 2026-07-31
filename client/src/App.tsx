import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import CommunityPage from "./pages/CommunityPage";
import PostPage from "./pages/PostPage";
import ProfilePage from "./pages/ProfilePage";
import LandingRedirect from "./components/LandingRedirect";
import FavoritesPage from "./pages/FavoritesPage";
import SearchPage from "./pages/SearchPage";
import NotificationsPage from "./pages/NotificationsPage";
import WeeklyPickPage from "./pages/WeeklyPickPage";
import BookPage from "./pages/BookPage";
import MarketplacePage from "./pages/MarketplacePage";
import ListingPage from "./pages/ListingPage";
import MessagesPage from "./pages/MessagesPage";
import AdminModerationPage from "./pages/AdminModerationPage";
import ReadingAIAssistant from "./components/ReadingAIAssistant";

function Router() {
  return (
    <Switch>
      <Route path="/welcome" component={LandingPage} />
      <Route path="/feed" component={Home} />
      <Route path="/community/:slug" component={CommunityPage} />
      <Route path="/post/:id" component={PostPage} />
      <Route path="/profile/:userId" component={ProfilePage} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/weekly" component={WeeklyPickPage} />
      <Route path="/book/:id" component={BookPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/listing/:id" component={ListingPage} />
      <Route path="/messages" component={MessagesPage} />
      <Route path="/admin/moderation" component={AdminModerationPage} />
      <Route path="/" component={LandingRedirect} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
          <ReadingAIAssistant />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
