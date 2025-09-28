import PlayersTable from "./GamePage/GamePage.jsx"
import { Route, Routes, useNavigate } from "react-router-dom";
import NavBar from "./NavBar/Navbar.jsx"
import HomePage from "./HomePage/HomePage.jsx"
import RatingPage from "./RaitingPage/RaitingPage.jsx";
import LoginPage from "./LoginPage/LoginPage.jsx";
import EventsPage from "./EventPage/EventPage.jsx";
import  Footer from "./Footer/Footer.jsx";
import TR from "./testRaiting/TR.jsx";
import RoadToBreak from "./BTS/BTS.jsx";
import Game from "./Event/Event.jsx";

const footerData = {
  ownerName: "© 2025 Company",
  copyright: "Ростислав Долматович",
  adress: "г.Москва г.Зеленоград Юности 11",
  
  contacts: {
    telegram: "https://t.me/ret1w",
    vk: "https://vk.com/ret1w",
  }
};


export function App(props) {
  return (
    <>
    <NavBar />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/Event/:eventId/Game/:gameId" element={<PlayersTable />} />
      <Route path="/Rating/:ratingId" element={<RatingPage/>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/BTS" element={<RoadToBreak />}/>
      <Route path="/Event/:evenId" element={<Game />} />
    </Routes>
   <Footer data={footerData} />
   </>
  );
}
export default App