import { Route, Switch } from "wouter";
import Index from "./pages/index";
import Explore from "./pages/explore";
import Atlas from "./pages/atlas";
import Mine from "./pages/mine";
import Leaderboard from "./pages/leaderboard";
import About from "./pages/about";
import FriendPage from "./pages/friend";
import NotFound from "./pages/not-found";
import { Provider } from "./components/provider";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/explore" component={Explore} />
        <Route path="/atlas" component={Atlas} />
        <Route path="/charts" component={Leaderboard} />
        <Route path="/mine" component={Mine} />
        <Route path="/about" component={About} />
        <Route path="/f/:collection/:id" component={FriendPage} />
        <Route component={NotFound} />
      </Switch>
    </Provider>
  );
}

export default App;
