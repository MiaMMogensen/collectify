import { Routes, Route, Navigate } from "react-router";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CreateCollection from "./pages/CreateCollection";
import AfterSignUp from "./pages/AfterSignUp";
import CollectionPage from "./pages/CollectionPage";
import AddItem from "./pages/AddItem";
import SubmitPage from "./pages/SubmitPage";
import SubmitSuccess from "./pages/SubmitSuccess";
import { useEffect } from "react";
import { ensureAnonAuth } from "../firebase-config";
import AddCategory from "./pages/CreateCategory";
import ScrollToTop from "./pages/ScrollToTop";
import CategoryPage from "./pages/CategoryPage";
import AddItemsToCategoryPage from "./pages/AddItemsToCategoryPage";
import Favourites from "./pages/Favourites";
import ProfilePage from "./pages/ProfilePage";
import AllCollectionsPage from "./pages/AllCollectionsPage";
import HomePage from "./pages/HomePage";
import DetailPage from "./pages/DetailPage";
import WishlistPage from "./pages/WishlistPage";
import AuthorPage from "./pages/AuthorPage";

export default function App() {
  useEffect(() => {
    ensureAnonAuth({ allowGuest: false }); // kræv rigtig bruger i jeres app
  }, []);
  return (
    <>
      <Header />
      <main>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/homepage" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/createcollection" element={<CreateCollection />} />
          <Route path="/after-signup" element={<AfterSignUp />} />
          <Route
            path="/users/:uid/collections/:collectionId"
            element={<CollectionPage />}
          />
          <Route
            path="/users/:uid/collections/:collectionId/createcategory"
            element={<AddCategory />}
          />
          <Route
            path="/users/:uid/collections/:collectionId/categories/:categoryId"
            element={<CategoryPage />}
          />
          <Route
            path="/users/:uid/collections/:collectionId/categories/:categoryId/add-items"
            element={<AddItemsToCategoryPage />}
          />
          <Route path="/additem" element={<AddItem />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/submitsuccess" element={<SubmitSuccess />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/allcollections" element={<AllCollectionsPage />} />
          <Route path="/items/:id" element={<DetailPage />} />
          <Route
            path="/users/:uid/collections/:collectionId/items/:id"
            element={<DetailPage />}
          />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/authors/:authorKey" element={<AuthorPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}
