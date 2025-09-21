import React from "react";
import { Link, NavLink } from "react-router-dom";

export default function NavBar() {
    return (
        <nav className="navbar navbar-expand-lg bg-body-tertiary border-bottom">
            <div className="container">
                <Link to="/" className="navbar-brand fw-bold">
                    MID Map
                </Link>
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        <li className="nav-item">
                            <NavLink to="/fix-mids" className="nav-link">
                                Fix Mids
                            </NavLink>
                        </li>
                        <li className="nav-item">
                            <NavLink to="/add-mids" className="nav-link">
                                Add Mids
                            </NavLink>
                        </li>
                        <li className="nav-item">
                            <NavLink to="/reports" className="nav-link">
                                Reports
                            </NavLink>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
}
