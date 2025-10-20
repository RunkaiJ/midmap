import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import FixMids from "./pages/FixMids.jsx";
import AddMids from "./pages/AddMids.jsx";
import Reports from "./pages/Reports.jsx"; 

export default function App() {
    return (
        <>
            <NavBar />
            <div className="container py-4">
                <Routes>
                    <Route
                        path="/"
                        element={<Navigate to="/fix-mids" replace />}
                    />
                    <Route path="/fix-mids" element={<FixMids />} />
                    <Route path="/add-mids" element={<AddMids />} />
                    <Route path="/reports" element={<Reports />} />
                </Routes>
            </div>
        </>
    );
}
