--
-- PostgreSQL database dump
--

\restrict ENUgCm2biJK5lLYfNbOpcoJHc4pNyhm5emUNNvgBgnbudI9CBOCN6K2kxiJYXBh

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: midmap; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA midmap;


--
-- Name: change_action; Type: TYPE; Schema: midmap; Owner: -
--

CREATE TYPE midmap.change_action AS ENUM (
    'auto_alias',
    'auto_name',
    'global_alias',
    'global_name'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: branches; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.branches (
    id bigint NOT NULL,
    station text NOT NULL,
    port_code text
);


--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: midmap; Owner: -
--

CREATE SEQUENCE midmap.branches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: midmap; Owner: -
--

ALTER SEQUENCE midmap.branches_id_seq OWNED BY midmap.branches.id;


--
-- Name: canonical_manufacturers; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.canonical_manufacturers (
    id bigint NOT NULL,
    good_mid text NOT NULL,
    manufacturer_name text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT canonical_manufacturers_good_mid_check CHECK ((btrim(good_mid) <> ''::text))
);


--
-- Name: canonical_manufacturers_id_seq; Type: SEQUENCE; Schema: midmap; Owner: -
--

CREATE SEQUENCE midmap.canonical_manufacturers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: canonical_manufacturers_id_seq; Type: SEQUENCE OWNED BY; Schema: midmap; Owner: -
--

ALTER SEQUENCE midmap.canonical_manufacturers_id_seq OWNED BY midmap.canonical_manufacturers.id;


--
-- Name: change_log; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.change_log (
    id bigint NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    action midmap.change_action NOT NULL,
    changed_by text,
    actor_branch text,
    airline_3d character(3) NOT NULL,
    master_bill_no text NOT NULL,
    importer_id text,
    client_name text,
    arrival_airport text,
    arrival_date date,
    bad_mid text,
    manufacturer_name text,
    good_mid text NOT NULL
);


--
-- Name: change_log_id_seq; Type: SEQUENCE; Schema: midmap; Owner: -
--

CREATE SEQUENCE midmap.change_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: midmap; Owner: -
--

ALTER SEQUENCE midmap.change_log_id_seq OWNED BY midmap.change_log.id;


--
-- Name: clients; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.clients (
    importer_id text NOT NULL,
    client_name text NOT NULL
);


--
-- Name: mid_aliases; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.mid_aliases (
    bad_mid text NOT NULL,
    good_manufacturer_id bigint NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mid_aliases_bad_mid_check CHECK ((btrim(bad_mid) <> ''::text))
);


--
-- Name: name_mappings; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.name_mappings (
    manufacturer_name text NOT NULL,
    good_manufacturer_id bigint NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: v_branches; Type: VIEW; Schema: midmap; Owner: -
--

CREATE VIEW midmap.v_branches AS
 SELECT station,
    port_code,
    ((station || ' | '::text) || port_code) AS label
   FROM midmap.branches;


--
-- Name: v_mid_change_report; Type: VIEW; Schema: midmap; Owner: -
--

CREATE VIEW midmap.v_mid_change_report AS
 SELECT changed_at,
    COALESCE(client_name, 'Unknown'::text) AS client,
    arrival_airport AS branch,
    airline_3d,
    master_bill_no,
    arrival_airport,
    arrival_date,
    bad_mid,
    good_mid,
    manufacturer_name,
    action,
    changed_by,
    actor_branch
   FROM midmap.change_log;


--
-- Name: branches id; Type: DEFAULT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.branches ALTER COLUMN id SET DEFAULT nextval('midmap.branches_id_seq'::regclass);


--
-- Name: canonical_manufacturers id; Type: DEFAULT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.canonical_manufacturers ALTER COLUMN id SET DEFAULT nextval('midmap.canonical_manufacturers_id_seq'::regclass);


--
-- Name: change_log id; Type: DEFAULT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.change_log ALTER COLUMN id SET DEFAULT nextval('midmap.change_log_id_seq'::regclass);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: branches branches_station_key; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.branches
    ADD CONSTRAINT branches_station_key UNIQUE (station);


--
-- Name: canonical_manufacturers canonical_manufacturers_good_mid_key; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.canonical_manufacturers
    ADD CONSTRAINT canonical_manufacturers_good_mid_key UNIQUE (good_mid);


--
-- Name: canonical_manufacturers canonical_manufacturers_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.canonical_manufacturers
    ADD CONSTRAINT canonical_manufacturers_pkey PRIMARY KEY (id);


--
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (importer_id);


--
-- Name: mid_aliases mid_aliases_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.mid_aliases
    ADD CONSTRAINT mid_aliases_pkey PRIMARY KEY (bad_mid);


--
-- Name: name_mappings name_mappings_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.name_mappings
    ADD CONSTRAINT name_mappings_pkey PRIMARY KEY (manufacturer_name);


--
-- Name: idx_changelog_branch; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_branch ON midmap.change_log USING btree (arrival_airport);


--
-- Name: idx_changelog_changed_at; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_changed_at ON midmap.change_log USING btree (changed_at DESC);


--
-- Name: idx_changelog_client; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_client ON midmap.change_log USING btree (client_name);


--
-- Name: idx_changelog_eta; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_eta ON midmap.change_log USING btree (arrival_date);


--
-- Name: idx_changelog_group; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_group ON midmap.change_log USING btree (arrival_date, airline_3d, master_bill_no);


--
-- Name: idx_changelog_key; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_key ON midmap.change_log USING btree (airline_3d, master_bill_no);


--
-- Name: idx_mid_aliases_good; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_mid_aliases_good ON midmap.mid_aliases USING btree (good_manufacturer_id);


--
-- Name: idx_name_mappings_good; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_name_mappings_good ON midmap.name_mappings USING btree (good_manufacturer_id);


--
-- Name: ux_change_log_unique_change; Type: INDEX; Schema: midmap; Owner: -
--

CREATE UNIQUE INDEX ux_change_log_unique_change ON midmap.change_log USING btree (arrival_date, airline_3d, NULLIF(btrim(master_bill_no), ''::text), upper(NULLIF(btrim(arrival_airport), ''::text)), NULLIF(btrim(client_name), ''::text), upper(NULLIF(btrim(bad_mid), ''::text)), upper(NULLIF(btrim(good_mid), ''::text))) WHERE ((bad_mid IS NOT NULL) AND (good_mid IS NOT NULL));


--
-- Name: mid_aliases mid_aliases_good_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.mid_aliases
    ADD CONSTRAINT mid_aliases_good_manufacturer_id_fkey FOREIGN KEY (good_manufacturer_id) REFERENCES midmap.canonical_manufacturers(id) ON DELETE RESTRICT;


--
-- Name: name_mappings name_mappings_good_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.name_mappings
    ADD CONSTRAINT name_mappings_good_manufacturer_id_fkey FOREIGN KEY (good_manufacturer_id) REFERENCES midmap.canonical_manufacturers(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict ENUgCm2biJK5lLYfNbOpcoJHc4pNyhm5emUNNvgBgnbudI9CBOCN6K2kxiJYXBh

