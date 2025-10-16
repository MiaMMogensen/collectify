import { Routes, Route, Navigate } from "react-router";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CreateCollection from "./pages/CreateCollection";
import AfterSignUp from "./pages/AfterSignUp";
import CollectionPage from "./pages/CollectionPage";
import AddItem from "./pages/AddItem";
import SubmitPage from "./pages/SubmitPage";
import AdminPendingItems from "./pages/AdminPendingItems";
import SubmitSuccess from "./pages/SubmitSuccess";
import { useEffect } from "react";
import { ensureAnonAuth } from "../firebase-config";

export default function App() {
  useEffect(() => {
    ensureAnonAuth({ allowGuest: false }); // kræv rigtig bruger i jeres app
  }, []);
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/createcollection" element={<CreateCollection />} />
          <Route path="/after-signup" element={<AfterSignUp />} />
          <Route
            path="/users/:uid/collections/:collectionId"
            element={<CollectionPage />}
          />
          <Route path="/additem" element={<AddItem />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/admin" element={<AdminPendingItems />} />
          <Route path="/submitsuccess" element={<SubmitSuccess />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}
