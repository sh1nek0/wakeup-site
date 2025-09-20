import PlayersTable from "./GamePage/GamePage.jsx"
import { Route, Routes, useNavigate } from "react-router-dom";
import NavBar from "./NavBar/Navbar.jsx"
import HomePage from "./HomePage/HomePage.jsx"
import RatingPage from "./RaitingPage/RaitingPage.jsx";
import LoginPage from "./LoginPage/LoginPage.jsx";
import EventsPage from "./EventPage/EventPage.jsx";
import { Footer } from "./HomePage/HomePage.jsx";

const footerData = {
  ownerName: "Долматович Ростислав",
  copyright: "Copyright © Долматович Ростислав",
  infoLinks: [
    { label: "Политика конфиденциальности", url: "/" },
    { label: "Условия использования", url: "/" },
  ],
  contacts: {
    telegram: "https://t.me/ret1w",
    vk: "https://vk.com/ret1w",
    phone: "+7 (925) 155-25-64",
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
    </Routes>
   <Footer data={footerData} />
   </>
  );
}
export default App