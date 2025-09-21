--
-- PostgreSQL database dump
--



-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2025-09-21 12:43:03

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
-- TOC entry 6 (class 2615 OID 16666)
-- Name: midmap; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA midmap;


--
-- TOC entry 857 (class 1247 OID 16668)
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
-- TOC entry 227 (class 1259 OID 16748)
-- Name: branches; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.branches (
    id bigint NOT NULL,
    station text NOT NULL,
    port_code text
);


--
-- TOC entry 226 (class 1259 OID 16747)
-- Name: branches_id_seq; Type: SEQUENCE; Schema: midmap; Owner: -
--

CREATE SEQUENCE midmap.branches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4973 (class 0 OID 0)
-- Dependencies: 226
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: midmap; Owner: -
--

ALTER SEQUENCE midmap.branches_id_seq OWNED BY midmap.branches.id;


--
-- TOC entry 220 (class 1259 OID 16681)
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
-- TOC entry 219 (class 1259 OID 16680)
-- Name: canonical_manufacturers_id_seq; Type: SEQUENCE; Schema: midmap; Owner: -
--

CREATE SEQUENCE midmap.canonical_manufacturers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4974 (class 0 OID 0)
-- Dependencies: 219
-- Name: canonical_manufacturers_id_seq; Type: SEQUENCE OWNED BY; Schema: midmap; Owner: -
--

ALTER SEQUENCE midmap.canonical_manufacturers_id_seq OWNED BY midmap.canonical_manufacturers.id;


--
-- TOC entry 224 (class 1259 OID 16723)
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
-- TOC entry 223 (class 1259 OID 16722)
-- Name: change_log_id_seq; Type: SEQUENCE; Schema: midmap; Owner: -
--

CREATE SEQUENCE midmap.change_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4975 (class 0 OID 0)
-- Dependencies: 223
-- Name: change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: midmap; Owner: -
--

ALTER SEQUENCE midmap.change_log_id_seq OWNED BY midmap.change_log.id;


--
-- TOC entry 218 (class 1259 OID 16673)
-- Name: clients; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.clients (
    importer_id text NOT NULL,
    client_name text NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 16693)
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
-- TOC entry 222 (class 1259 OID 16708)
-- Name: name_mappings; Type: TABLE; Schema: midmap; Owner: -
--

CREATE TABLE midmap.name_mappings (
    manufacturer_name text NOT NULL,
    good_manufacturer_id bigint NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 228 (class 1259 OID 16758)
-- Name: v_branches; Type: VIEW; Schema: midmap; Owner: -
--

CREATE VIEW midmap.v_branches AS
 SELECT station,
    port_code,
    ((station || ' | '::text) || port_code) AS label
   FROM midmap.branches;


--
-- TOC entry 225 (class 1259 OID 16738)
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
-- TOC entry 4782 (class 2604 OID 16751)
-- Name: branches id; Type: DEFAULT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.branches ALTER COLUMN id SET DEFAULT nextval('midmap.branches_id_seq'::regclass);


--
-- TOC entry 4776 (class 2604 OID 16684)
-- Name: canonical_manufacturers id; Type: DEFAULT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.canonical_manufacturers ALTER COLUMN id SET DEFAULT nextval('midmap.canonical_manufacturers_id_seq'::regclass);


--
-- TOC entry 4780 (class 2604 OID 16726)
-- Name: change_log id; Type: DEFAULT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.change_log ALTER COLUMN id SET DEFAULT nextval('midmap.change_log_id_seq'::regclass);


--
-- TOC entry 4967 (class 0 OID 16748)
-- Dependencies: 227
-- Data for Name: branches; Type: TABLE DATA; Schema: midmap; Owner: -
--

INSERT INTO midmap.branches VALUES (1, 'JFK', '4701');
INSERT INTO midmap.branches VALUES (2, 'LAX', '2720');
INSERT INTO midmap.branches VALUES (3, 'SFO', '2801');
INSERT INTO midmap.branches VALUES (4, 'ORD', '3901');
INSERT INTO midmap.branches VALUES (5, 'DFW', '5501');
INSERT INTO midmap.branches VALUES (6, 'MIA', '5206');
INSERT INTO midmap.branches VALUES (7, 'ATL', '1704');
INSERT INTO midmap.branches VALUES (8, 'BOS', '0417');
INSERT INTO midmap.branches VALUES (9, 'SEA', '3029');


--
-- TOC entry 4961 (class 0 OID 16681)
-- Dependencies: 220
-- Data for Name: canonical_manufacturers; Type: TABLE DATA; Schema: midmap; Owner: -
--

INSERT INTO midmap.canonical_manufacturers VALUES (653, 'CNGUAINA7GUA', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (654, 'CNGAOXIN116BAO', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (655, 'CNGAOXIN236BAO', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (656, 'CNGUAPAN960GUA', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (658, 'CNJINQIN235JIN', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (659, 'CNYANSEN462YAN', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (660, 'CNWENCOU22GUA', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (661, 'CNSHAYUP458SHA', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (662, 'CNDALWUF1HUI', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (663, 'CNZHECHI99GUA', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (664, 'CNSHAZHA925SHA', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (665, 'CNGAOXIN424BAO', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (666, 'CNBAOTAO64BAO', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (667, 'CNBAINEW48BAO', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (668, 'CNYIWQIH7JIN', NULL, '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.canonical_manufacturers VALUES (283, 'CNGUAGUL334GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (9, 'CNDONSHA800DON', 'Dongguan Shanjia Clothing Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (45, 'CNQIAECO2JIN', 'Yiwu Qiangkuang Ecommerce Store (Individual Business)', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (6, 'CNCHECHUBAO', 'Baoding Chenchuang Trading Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (59, 'CNTAIINDTAI', 'Taizhou Borui Industry and Trade Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (75, 'CNZHUJIU99SHA', 'Zhuji Jiuzhi Textile Factory', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (57, 'CNSUZTIA4555SUZ', 'Suzhou Tianbianyou Culture Media Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (192, 'CNBAINEW857BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (193, 'CNGAOXIN9902BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (194, 'CNFOSFEI302FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (195, 'CNBAINEW9906BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (196, 'CNGAONEW9904BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (197, 'CNBAOBOP132BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (198, 'CNFOSANY9903FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (199, 'CNHANYIF603HAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (200, 'CNHUBSHU21TIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (67, 'CNXINZUL1819XIN', 'Xinyu Zulu Shoes Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (202, 'CNHONBEI3FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (203, 'CNDONMAO93JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (204, 'CNDAQZHA3DAQ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (205, 'CNGUAYUX9906GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (206, 'CNBAOSHU5BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (207, 'CNGAOXIN421BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (208, 'CNGAOXIN3071BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (209, 'CNHAIMEI118HAI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (210, 'CNHEJIA19JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (211, 'CNGAOXIN623BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (212, 'CNBEIHEN4YUL', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (213, 'CNGUAHEL521GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (214, 'CNYIWKUN704JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (215, 'CNFOSKAQ48FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (216, 'CNZHEOST403ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (217, 'CNGUAFUH9GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (218, 'CNYUECOU4ANQ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (219, 'CNSHEQIN984SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (220, 'CNBAOCHE99BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (221, 'CNXIASUP89ZHU', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (222, 'CNYUAHOM68SUI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (223, 'CNYIWQIS1666JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (224, 'CNZHEAIY9900JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (225, 'CNYUEREM9ANQ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (226, 'CNKUADEP511FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (227, 'CNBAINEW787BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (228, 'CNGAOXIN419BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (229, 'CNWUHXIX32WUH', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (230, 'CNBAONUO7BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (231, 'CNJUNINC2LIS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (232, 'CNZHAXIA1542ZHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (233, 'CNGUASHU408GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (234, 'CNQINCIT3014QIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (235, 'CNFOSCOL553FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (236, 'CNNANYAQ3NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (237, 'CNGUAMIM67GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (238, 'CNQINSHO421QUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (239, 'CNHUAMEI21GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (240, 'CNJIULIT1092JIU', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (241, 'CNDONCHI401JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (242, 'CNGAOCIT9901BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (243, 'CNGUASEA245GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (244, 'CNGUAZHI995GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (245, 'CNJIAWEN215HAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (246, 'CNBAOMEI328BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (247, 'CNGUASIN27GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (248, 'CNDONZHU93JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (249, 'CNZHECAI13ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (250, 'CNGAOWEI233BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (251, 'CNBAOHOU1BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (252, 'CNXIAECO28FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (253, 'CNGUABOP9915GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (254, 'CNGUAXIO929GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (255, 'CNFOSBEI708FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (256, 'CNYANJIN8XUC', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (257, 'CNHUASHE589HUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (258, 'CNYIWKOU1611JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (259, 'CNYUECOU83ANQ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (260, 'CNYIWQIA613JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (261, 'CNGAOXIN6081BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (262, 'CNWUHBOY167WUH', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (263, 'CNYIWJIN4348JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (264, 'CNFOSJIA9902FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (265, 'CNUSCCRO518JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (266, 'CNGAOXIN402BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (267, 'CNLEIDIG46SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (268, 'CNGUAWEI434GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (269, 'CNGONXIN64JIU', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (270, 'CNGAOXIN101BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (271, 'CNGAOYUE301BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (272, 'CNGUADAN194GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (273, 'CNBAODAL108BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (274, 'CNYINDEP17FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (275, 'CNANQYIH83ANQ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (276, 'CNMINCOU1018SHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (277, 'CNGAOLIA3160BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (278, 'CNHENBUF592ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (279, 'CNSHASEN462SHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (280, 'CNCHAWAN42CHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (281, 'CNDABDEP26ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (282, 'CNGAOXIN223BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (284, 'CNFOSYIR130FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (285, 'CNTAIJUY32TAI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (286, 'CNYIWKAN655JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (287, 'CNYIWWOY6JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (288, 'CNYIWMAG27JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (289, 'CNNANXUZ178NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (290, 'CNZHUHAO151SHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (291, 'CNQITYUN23QIT', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (292, 'CNSHIQIA99SHI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (293, 'CNSHE9910JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (294, 'CNYIWTUA994JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (295, 'CNYIWXUG9JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (296, 'CNFOSBEI9901FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (297, 'CNDONBUG7JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (298, 'CNBAINEW733BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (299, 'CNBAINEW351BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (300, 'CNGUALIH287GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (301, 'CNYIWCOO157JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (302, 'CNGAOXIN531BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (303, 'CNHEFDIE1188HEF', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (122, 'VNBINBGBAC', 'AN BINH BG GARMENT COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (305, 'CNNANMEI99QUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (306, 'CNGUAYIB196GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (307, 'CNWENNIS9938WEN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (308, 'CNYIWAIX9930JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (309, 'HKHONKON98YAU', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (310, 'CNZHOHAN19ZHO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (311, 'CNGUAYUQ23GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (312, 'CNWANHAN7CHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (313, 'CNYIWSHI2120JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (314, 'CNGUARUN353GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (315, 'CNJINCOM341BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (316, 'CNFOSAIR3FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (317, 'CNYIWJUC874JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (318, 'CNYIWCHO555JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (319, 'CNWUJLIX5SUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (320, 'CNHEFXIN1223HEF', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (321, 'HKSUNCOKWU', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (322, 'CNMENSEL6HAI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (323, 'CNXIAMIS7ZHO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (324, 'CNYIWHEQ8JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (325, 'CNXIXNEW2062XIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (326, 'VNMINVIE2845HAI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (146, 'VNHUNFUN24DAK', 'HUNG FUNG GARMENT (VIETNAM) CO., LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (328, 'CNBAINEW1BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (329, 'CNYIWRON399JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (330, 'CNDONFUYJIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (331, 'CNFOSQIJ6FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (332, 'CNDONDUR5JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (333, 'CNGAOXIN427BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (334, 'CNYIWJIX715JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (335, 'CNSUZFUM9SUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (336, 'CNNANGAL479NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (337, 'CNZHEZHE92ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (338, 'CNYIDPIN3YIC', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (339, 'CNGUAMAN680GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (340, 'CNGUASHE611GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (341, 'CNGUAXIK238GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (342, 'CNSHICOU15CHI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (343, 'CNDONDIS8KUN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (344, 'CNGAOLIA7205BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (345, 'CNDONMOU30JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (346, 'CNSHESHE18SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (347, 'CNHECART1418HAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (4, 'CNBAOCHE6BAO', 'YIWU XINMAN JEWELRY CO. LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (349, 'CNMEEBEA61FUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (350, 'CNSHEMIL847SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (351, 'CNGUAOMA123GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (352, 'CNYIWNIT8JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (353, 'CNYIWKEZ3JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (354, 'CNQINLAK888NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (355, 'CNSHAQIN2816SHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (356, 'CNHANHOU308HAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (357, 'CNSHEQUZ273SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (358, 'CNLIN3831JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (359, 'CNXIUCOU154JIU', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (360, 'CNYUEREH9ANQ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (361, 'CNHANMIT1399HAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (362, 'CNGAOXIN327BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (363, 'CNYIWLAI5JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (364, 'CNYIWFUW18JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (365, 'CNBAOVAL7BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (366, 'CNYIWXID788JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (367, 'CNSHETRA8GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (368, 'CNJIADIA326NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (369, 'CNMIACOU9HAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (370, 'CNFUZGUL18FUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (371, 'CNHANYUH1399HAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (372, 'CNBAIXIN8BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (373, 'CNXINTEX70QIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (374, 'CNYIWDUC9JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (375, 'CNYIWPUY8JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (376, 'CNPUJJIA19JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (377, 'CNYIWNIA14JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (378, 'CNGUIBAO29GUI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (379, 'CNZHEGUA329ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (380, 'CNWUHNEW58WUH', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (381, 'CNGUALON665GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (382, 'CNZHEMOY7ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (383, 'CNTIACHA402TIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (384, 'CNBAOBAI1BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (385, 'CNTIAZHE116TIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (386, 'CNTAIBOR1TAI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (387, 'CNZHUYIS772SHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (388, 'CNSHEULU7012SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (389, 'CNSHALAN170SHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (390, 'CNNANHAO3399NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (391, 'CNDONSHI101DON', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (392, 'CNBAINEW28BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (393, 'CNSUZIND199SUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (394, 'CNGUAMUY328GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (395, 'CNZHAZHE1212JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (396, 'CNSUSHUI15HUI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (397, 'CNYIWSU508JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (398, 'CNJINHUI3QUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (399, 'CNGAOXIN1411BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (400, 'CNFOSDEC38FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (401, 'CNCENWEI2WUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (402, 'CNDONYIT5JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (403, 'CNZHUYUA216ZHU', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (404, 'CNSHEKAI12SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (405, 'CNSHEXIN53SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (406, 'CNGUAXIJ278GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (407, 'CNGUAQIA222GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (408, 'CNWUHWEI58WUH', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (409, 'CNYUNTRA12FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (410, 'CNFOSANN8FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (411, 'CNFOSSUM4FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (412, 'CNLEFDEP23LUO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (413, 'CNDONJUN116JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (414, 'CNGUASHI445GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (415, 'CNWUHYOU77WUH', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (416, 'CNSHEMAI375SHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (417, 'CNYIWPUM36JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (418, 'CNYIWBOD5JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (419, 'CNPUJQIA7JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (420, 'CNBEIMIN319BEI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (421, 'CNWUHDON450WUH', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (422, 'CNGUAYIN680GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (423, 'CNYIWLUS715JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (424, 'CNYIWINT3JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (425, 'CNYIWGAI9JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (426, 'CNXIAYIR159XIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (427, 'CNBAOHUI209BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (428, 'CNBAOBAI60BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (429, 'CNPUJTUO371JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (430, 'CNTOUTRA302JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (431, 'CNYIWKUO606JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (432, 'CNYIWXUA405JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (433, 'CNSHUCOU20SUQ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (434, 'CNYIWNAN931JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (435, 'CNCHAWAN8006CHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (436, 'CNDINSUP8GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (437, 'CNGAOXIN403BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (438, 'CNYIWFUX8JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (439, 'CNYIWFUX9JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (440, 'CNHEBQIB4HEB', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (441, 'CNZHEZHU52ZHE', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (442, 'CNSHIHUI500QUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (443, 'CNPOYCOU69SHA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (444, 'CNGUAYA503GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (445, 'TRTEKTEK72IST', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (446, 'CNTIAHUA6TIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (447, 'CNDONMAN409DON', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (448, 'CNGUAXUA106GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (449, 'CNGUAYIS103GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (450, 'CNXINCHE2188HUL', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (451, 'CNSHEDEP468EZH', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (452, 'CNYIWBIN4417JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (453, 'CNYIWPAS33JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (454, 'CNSUZYIW995SUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (455, 'CNGUAYIH18LIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (456, 'CNYIWFUX715JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (457, 'CNYIWENR9JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (458, 'CNNANLUO48NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (459, 'CNFOSCOO8FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (460, 'CNFOSYAD4FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (461, 'CNSHEBEA8FOS', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (462, 'CNGUABAN806DON', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (463, 'CNSHIWAL237QUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (464, 'CNQINDIS3NAN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (465, 'CNGUAYAO211GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (466, 'CNYIWZIL718JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (467, 'CNSHAYIQ11RIZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (468, 'CNGUANUA7GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (469, 'CNYIWBET4JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (470, 'CNBAIXIN7BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (471, 'CNQINQIY3QIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (472, 'CNXIACIT2010XIA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (473, 'CNGAOXIN4441BAO', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (474, 'CNPUJZHE99JIN', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (475, 'CNORCGAR302GUA', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (476, 'CNSUZTAI9SUZ', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (477, 'CNTAIYUN25TAI', NULL, '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.canonical_manufacturers VALUES (33, 'CNJINJIN5547JIN', 'Jinhua Jindong District Liju Ecommerce Firm', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (14, 'CNGAN806GAN', 'GanZhouPanHongTechnology', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (37, 'CNLINCOL1126ANY', 'LINZHOUJINPENGSHANGMAO CO..LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (40, 'CNNO1BIN303JIN', 'NO.1177,BINHAI, LONGWAN, WENZHOU.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (64, 'CNXIN9104XIN', 'XINYUSHIXIANNVHUQUQIANHEBAIHUIZHIXIECHANG', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (60, 'CNWENCO26WEN', 'Wenzhoushifengyiwujinzhipin Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (63, 'CNXIN2100HUL', 'XINGCHENGHUIMEICLOTHINGMANUFACTURINGFACTORY', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (11, 'CNFOSOLT1090FOS', 'FOSHANSHIMMUPINGFUSHI O..LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (24, 'CNHAOCOL912TAI', 'Haomiao.electronic.commerce co.,ltd', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (73, 'CNZHOCOL493GUA', 'ZHONGQINMAOYIGUANGZHOU CO..LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (18, 'CNGUA2330GUA', 'GUANGZHOUSHILINGLINGQIKEJIFAZHANCO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (41, 'CNNO5PET5XIA', 'NO.5, PETROLEUM ROAD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (44, 'CNPUJMEM8282JIN', 'PUJIANG MEMORY TOY CO., LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (32, 'CNJINCOL360JIN', 'JINHUASHIQINRONGMAOYI CO.LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (1, 'CNANHHEY2105HEF', 'ANHUI HEYE NETWORK TECHNOLOGY CO., LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (48, 'CNSHE179SHE', 'SHENZHENJIAMIWANGLUOISHUCO..LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (47, 'CNSHE1353SHE', 'SHENZHENSHIANRUNTAIKEJICO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (20, 'CNGUAAIC3183GUA', 'GUANGZHOU AICHUANGJINCHUKOUMAOYI CO., LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (13, 'CNFUJCHE814FUZ', 'Fujian Chengrui Shoes Industry Co. , Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (42, 'CNPANJIN202JIN', 'PANAN JINGYA HORTICULTURAL SUPPLIES FACTORY', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (28, 'CNHUACOL104BEN', 'HUAIYUANXINHAODIANZISHANGWU CO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (17, 'CNGUA162JIE', 'GUANGZHOUTONGRUNTRADINGCO..LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (30, 'CNHUIWOM2282XIN', 'HUIYU WOMEN''S SHOE FACTORY', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (12, 'CNFOSSHA2450FOS', 'Foshan Shanmu clothing Co., LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (29, 'CNHUIDUD234HUI', 'HUIZHOU DUDU PET PRODUCTS CO., ITD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (25, 'CNHENCIT153HEN', 'Hengyang City Coarse Tea and Rice Catering Culture Ltd', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (31, 'CNJIN890JIN', 'JINHUAGUOYOUHOMEFURNISHINGCO.LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (58, 'CNTAICOL413TAI', 'TAIZHOUSHIDAHONGBAOGONGYIPIN CO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (10, 'CNFOS2119FOS', 'Foshanshixuntuodianzico.Ltd', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (68, 'CNYIW2310JIN', 'YIWUSHIYOUKEJINCHUKOUCO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (16, 'CNGUA1076GUA', 'GUANGZHAUYUNNIFUSHICO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (72, 'CNZHEMEN1188JIN', 'ZHEJIANG MENGDA IMPORT AND EXPORT CO., LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (53, 'CNSHELTD238SHE', 'SHENZHENSHIDONGHEXINKEJI.CO,.LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (39, 'CNMOUCOU2744CHU', 'MOUDING COUNTY KUNI DEPARTMENT STORE SOLE PROPRIETORSHIP', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (46, 'CNSHACOL1595RIZ', 'SHANDONGTAHAIWANGLUOKEJI CO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (19, 'CNGUA850DON', 'GUANGZHOUHUIWANGDIANZISHANGWUCO..LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (35, 'CNKAIGARXIN', 'Xingcheng Kaisheng Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (66, 'CNXINKAI6543HUL', 'Xingcheng Kaiwei Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (34, 'CNKAIGARHUL', 'Xingcheng Kairuida Garment Co', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (8, 'CNDONCOL364FUZ', 'DONGMING CO.LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (2, 'CNBAINEW297BAO', 'Baigou New Town Yaohuo Bags Factory (individual business owner)', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (27, 'CNHUACHA570GUA', 'Huangshi Chaoju Clothing Store, Baiyun District, Guangzhou City', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (38, 'CNMEIHESQUA', 'Nan''an Meishan Hesheng Knitting Factory', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (5, 'CNBUYCLOSHA', 'Shantou Buyun Clothing Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (7, 'CNDINFAS501DON', 'Dongguan Dingyangfeng Fashion Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (65, 'CNXINKAI1HUL', 'Xingcheng Kairuida Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (71, 'CNYUEMEN46WEN', 'Yueqing Mengfu International Trade Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (70, 'CNYIWYAQ205JIN', 'Yiwu Yaqin Electronic Commerce Company (individual business owner)', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (69, 'CNYIWU146JIN', 'Yiwu Yaoer Ecommerce Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (51, 'CNSHE85SHA', 'Shenzhen 85 WinWin Trading Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (56, 'CNSHEZHE6SHE', 'Shenzhen Dechuang Photoelectric Technology Co., Ltd', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (23, 'CNGUAZUO108GUA', 'Guangzhou Zuomu Trading Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (22, 'CNGUAHUI302GUA', 'Guangzhou Huiya Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (74, 'CNZHUBAO164XUC', 'Changge City Zhubao General Store (Individual Business)', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (43, 'CNPEISHA2263GUA', 'GUANGZHOUPEISHANFUZHUANGGONGYINGLIANGUANICO.LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (55, 'CNSHESENWEN', 'Wenzhoushensengongju Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (15, 'CNGANTEC1026GAN', 'GanZhouPanHong Technology Co., LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (61, 'CNWENCO497WEN', 'Wenzhouyihewanjuzhizao Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (21, 'CNGUACOL2202GUI', 'GUANGXIPINGNANXIANYUHANKEJI CO..LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (52, 'CNSHEBEA3241SHE', 'SHENZHEN BEAUTIFUL STORY TRADING CO., LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (3, 'CNBANTOO463GUA', 'BANANA TOOTH CLOTHING CO.LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (50, 'CNSHE683SHE', 'SHENZHENJIECHANGSHENGINDUSTRIALCO..LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (49, 'CNSHE201SHE', 'SHENZHENTUOWEIDIANZISHANGWUCO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (26, 'CNHESSUJWEN', 'Wenzhouheshengsujiao Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (62, 'CNWENZHOWEN', 'Wenzhouchangchuangshangmao Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (54, 'CNSHEPHO6SHE', 'ZHENGZHOUAMIERMAOYI CO.LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (36, 'CNLANSEA2236HUL', 'PUJIANGXIANFULIUMANMAOYICO.LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (111, 'KHWANLY137PHN', 'Wan Ly (Cambodia) Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (97, 'KHLONCAMPHN', 'Lonso (Cambodia) Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (114, 'KHXUNINT32PHN', 'Xundu International Trading Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (169, 'VNTHAVANHAI', 'THAM VAN COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (100, 'KHNEWJINPHN', 'New Jing Feng (Cambodia) Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (181, 'VNVIESHA2180BIN', 'Vietnam Shangya Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (155, 'VNMBVIE5817HOC', 'MB Vietnam Garment Production Trading Service Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (140, 'VNGIAPHU30HOC', 'Gia Phuc Development Production Trading Service Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (105, 'KHSANMATPHN', 'San Mateo Garment (Cambodia) Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (130, 'VNDAIDUO43HAN', 'Dai Duong Hai Duong Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (184, 'VNYINGAR52BIN', 'YINIFU CLOTHING COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (127, 'VNCHAHUN30HOC', 'Chan Hung Garment Import-Export Production Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (183, 'VNYENGOL814HOC', 'YENI GOLDEN IMPORT EXPORT TRADING COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (149, 'VNJOYVINHUN', 'Joy Vina Fashion Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (115, 'KHYILAN18PHN', 'Yi Lan Ji Garment (Cambodia) Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (126, 'VNCHAHUN1826HOC', 'CHAN HUNG IMPORT EXPORT GARMENT PRODUCTION COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (113, 'KHXIYVIE1206PHN', 'XIYIN VIETNAM DISTRIBUTION COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (161, 'VNSAIGAR464HOC', 'Saigon Garments Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (81, 'KHCAMFORPHN', 'Cam Forever Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (137, 'VNDUYMIN28HOC', 'Duy Minh Phat Trading Production Garment Import Export Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (104, 'KHRUIWEN27PHN', 'Rui Wen Aries (Cambodia) Garments Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (128, 'VNCHUGAR1THA', 'KHOI NGHIEP GARMENT COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (96, 'KHJOYRIC6KAM', 'Joy Rich Garment (Cambodia) Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (165, 'VNTANHAI3904HOC', 'Tan Hai Sinh', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (131, 'VNDAIMA24THA', 'Dai Ma Garment Import-Export Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (99, 'KHNEWERA21PHN', 'New Era (Cambodia) Cashmere Textile Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (109, 'KHSIXINKAN', 'Si Xin Underwear Factory', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (164, 'VNSHAVIE2180BIN', 'Shangya Vietnam Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (170, 'VNTHIHUN225HOC', 'Thien Hung Phat Factory', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (172, 'VNTHIPHO475HOC', 'Thinh Phong Fashion Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (92, 'KHHONGAR34KAN', 'Hongruida Garment (Cambodia) Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (175, 'VNTRUPHAHAN', 'Truong Phat Hanoi Production and Trading Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (124, 'VNCAOLON3HOC', 'CAO LONG PRODUCTION AND TRADING COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (78, 'KHBLUVIS789PHN', 'BLUE VISTA CO.,LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (86, 'KHCHICAMPHN', 'Chicbuck (Cambodia) Garments Manufacturing Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (76, 'KHACTSEA130PHN', 'Active Seamless (Cambodia) Co.,LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (91, 'KHGRAINDPHN', 'Grandfield Industry Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (147, 'VNHUNHA99HUN', 'Hung Ha Garment Production and Import-Export Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (179, 'VNVANPHA99HOC', 'AN VAN PHAT GROUP Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (150, 'VNKHUMAI3661HOC', 'Khuong Mai Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (90, 'KHFOMCAMPHN', 'Foms (Cambodia) Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (141, 'VNGLOFAS52HOC', 'Global Fashion', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (95, 'KHJIN1019PHN', 'Jinxiu', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (108, 'KHSHUYIN30PHN', 'Shun Ying Jiu Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (158, 'VNNAMPHA1HAN', 'Nam Phat Import - Export Production Trade JSC', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (77, 'KHAOKGARPHN', 'Aokai Garments Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (167, 'VNTHAPHA9932HOC', 'Thanh Phat Garment Production and Import-Export Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (85, 'KHCHESHI122PHN', 'CHENG SHI XIN MANUFACTURINGCOMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (121, 'VNBELTEX1678HOC', 'Bella Textile Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (98, 'KHMOOTAIPHN', 'Great New Talent Factory (Cambodia) Co,LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (138, 'VNGARPRO9913BIN', 'X Garment Production & Trading Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (80, 'KHCAMFOR1PHN', 'Cam Forever Co., Ltd Garment Factory', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (118, 'VNANHPHA996BAC', 'The Anh Phat Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (154, 'VNLONQIY202LON', 'CONG TYTNHH MAY MAC LONGAN QIYUE', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (136, 'VNDONVIE21HOC', 'DONY VIETNAM COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (94, 'KHHUASHA188KAN', 'Huanan Shanggu Apparel (Cambodia) Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (123, 'VNBYUS36HOC', 'BY US Joint Stock Company', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (101, 'KHOPTGARPHN', 'Optima Garment (Cambodia) Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (177, 'VNTUYTHA361HAI', 'NEW FACE SERVICE TRADING INVESTMENT LIMITED COMPANY', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (176, 'VNTRUTHA171HOC', 'Truong Thao Garment Joint Stock Company', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (83, 'KHCAMXIN2PHN', 'CAMBODIAN XIN HUANG MING GARMENT CO.,LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (119, 'VNAPDGARBEN', 'APD Garment Manufacturing Limited Company', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (163, 'VNSDGLO3HUN', 'SD Global Vina Garment Export Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (102, 'KHRUISEN15PHN', 'Linglingxiu Clothing Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (148, 'VNINDINTHUN', 'Indico International Trading and Garment Joint Stock Company', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (132, 'VNDANMIN515DON', 'Dang Minh Phat Fashion Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (171, 'VNTHILOC2739BIN', 'Thien Loc Vietnam Import Export Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (139, 'VNGGLON2HOC', 'G&G LONG AN FASHION CO., LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (142, 'VNHAIDUO43HAN', 'Hai Duong Dai Duong Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (117, 'KHYUETUN85PHN', 'Yuen Tung Clothing Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (144, 'VNHANTIE9923HAI', 'Han Tien Garment Import Export and Production One Member Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (89, 'KHFENGAR1PHN', 'Fengsheng Garment Factory', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (82, 'KHCAMVIT2PHN', 'CAMBO VITALITY GARMENT CO., LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (87, 'KHDEXIAPHN', 'De Xiang Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (84, 'KHCENCAM2PHN', 'Centric (Cambodia) Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (152, 'VNKIMLONHUN', 'Kim Long Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (135, 'VNDONCLO126THA', 'DONGMAO CLOTHING TRADE LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (185, 'VNYLDGARHUN', 'YLD Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (112, 'KHXINHONPHN', 'Xin Hong Peng (Cambodia) Knitting Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (125, 'VNCATTUO121HOC', 'Cat Tuong Garment Export Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (162, 'VNSAIGON464HOC', 'Sai Gon Garments Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (133, 'VNDARFASHAI', 'Darwin Fashion Production and Supply Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (88, 'KHETEFAMPHN', 'Eternal Fame (Cambodia) Garments Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (168, 'VNTHATRA297HAN', 'Thai Trang Hang Phong Production Trading Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (173, 'VNTHIPHU19HOC', 'Thien Phu Fashion Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (129, 'VNCHUYU344BIN', 'Chuang Yu International Trading Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (151, 'VNKIMLOI41HOC', 'Kim Loi Lai Garment Co.,Ltd', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (174, 'VNTPPGAR245HOC', 'TPP Garment One Member Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (110, 'KHSUNGAR2PHN', 'Sunrise Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (106, 'KHSANTAIPHN', 'SANTA TAI FACTORY CO., LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (134, 'VNDARFASHAN', 'Darwin Fashion Production and Supply Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (156, 'VNMINDATTHA', 'MINH DAT – THANH HOA COOPERATIVE', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (160, 'VNREGMIR9HAI', 'Regina Miracle International (Vietnam) Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (103, 'KHRUISEN1PHN', 'RUI SEN JIA GARMENT CO.,LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (159, 'VNPHOVIENIN', 'Phoenix Vietnam Investment and Production Joint Stock Company', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (182, 'VNWINVIE4HAI', 'Wingsburg Vietnam Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (157, 'VNMINVIE9928HAI', 'Minh Viet Phat Trading and Manufacturing Company Limited', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (178, 'VNVANPHA98HOC', 'AN VAN PHAT GROUP COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (166, 'VNTHABIN9902THA', 'Thai Binh Tue Com Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (120, 'VNBACTHI62BIN', 'Bach Thinh', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (153, 'VNLEEFAS99HOC', 'LEE FASHION TRADING AND PRODUCTION COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (79, 'KHBUSGAR130PHN', 'PROGRESSIVE GARMENT CO.,LTD', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (116, 'KHYOU44KAM', 'YOUNG2', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (180, 'VNVIEHANHUN', 'VIET HAN SJC GARMENT COMPANY LIMITED', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (143, 'VNHANHONHAN', 'Hanjie Garment Co., Ltd.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (93, 'KHHSXLTD1928PHN', 'H.S.XPRINTINGEMBROIDERYCO.,LTD.', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (145, 'VNHNTGAR2HOC', 'HNT Garment Import Export Limited Company', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.canonical_manufacturers VALUES (107, 'KHSANTAITAK', 'SANTA TAI FACTORY CO., LTD.', '2025-09-20 16:39:48.971788-04');


--
-- TOC entry 4965 (class 0 OID 16723)
-- Dependencies: 224
-- Data for Name: change_log; Type: TABLE DATA; Schema: midmap; Owner: -
--



--
-- TOC entry 4959 (class 0 OID 16673)
-- Dependencies: 218
-- Data for Name: clients; Type: TABLE DATA; Schema: midmap; Owner: -
--

INSERT INTO midmap.clients VALUES ('2567947', 'SHEIN');


--
-- TOC entry 4962 (class 0 OID 16693)
-- Dependencies: 221
-- Data for Name: mid_aliases; Type: TABLE DATA; Schema: midmap; Owner: -
--

INSERT INTO midmap.mid_aliases VALUES ('CNDONDIN501DON', 9, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSUZTIA455SUZ', 57, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW002BAO', 192, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0225BAO', 193, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSFEI03FOS', 194, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW06BAO', 195, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAONEW0426BAO', 196, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOBOP0132BAO', 197, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSANY03FOS', 198, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHANYIF5715HAN', 199, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHUBSHU213TIA', 200, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXINZUL35XIN', 67, 'Alex @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHONBEI13FOS', 202, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONMAO938JIN', 203, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDAQZHA1DAQ', 204, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAYUX066GUA', 205, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOSHU1BAO', 206, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0421BAO', 207, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0307BAO', 208, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHAIMEI03HAI', 209, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHEJIA18JIN', 210, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0623BAO', 211, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBEIHEN3YUL', 212, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAHEL335GUA', 213, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWKUN1JIN', 214, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSKAQ10FOS', 215, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHEOST10ZHE', 216, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAFUH4GUA', 217, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYUECOU04ANQ', 218, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEQIN01SHE', 219, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOCHEBAO', 220, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXIASUP021ZHU', 221, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYUAHOM068SUI', 222, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWQIS1104JIN', 223, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHEAIY002JIN', 224, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXINZUL18XIN', 67, 'Alex @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYUEREM4ANQ', 225, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNKUADEP0098FOS', 226, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW024BAO', 227, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0419BAO', 228, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWUHXIX12WUH', 229, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAONUO3BAO', 230, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNJUNINC1LIS', 231, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHAXIA128ZHA', 232, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUASHU407GUA', 233, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNQINCIT301QIN', 234, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSCOL02FOS', 235, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNNANYAQ002NAN', 236, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAMIM067GUA', 237, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNQINSHO0421QUA', 238, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHUAMEI002GUA', 239, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNJIULIT109JIU', 240, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONCHI4018JIN', 241, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOCIT0114BAO', 242, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUASEA24GUA', 243, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAZHI286GUA', 244, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNJIAWEN1HAN', 245, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOMEI0328BAO', 246, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUASIN275GUA', 247, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONZHU938JIN', 248, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHECAI134ZHE', 249, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOWEI0233BAO', 250, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOHOU01BAO', 251, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXIAECO02FOS', 252, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUABOP119GUA', 253, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAXIO701GUA', 254, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSBEI707FOS', 255, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYANJIN18XUC', 256, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHUASHE5HUA', 257, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWKOU307JIN', 258, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYUECOU083ANQ', 259, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWQIAJIN', 260, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0608BAO', 261, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWUHBOY08WUH', 262, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWJIN0434JIN', 263, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSJIA02FOS', 264, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNUS518JIN', 265, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0402BAO', 266, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNLEIDIG1046SHE', 267, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAWEI0064GUA', 268, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGONXIN064JIU', 269, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0101BAO', 270, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOYUE0301BAO', 271, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUADAN003GUA', 272, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAODAL0108BAO', 273, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYINDEP03FOS', 274, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNANQYIH083ANQ', 275, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNMINCOU029SHA', 276, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOLIA0031BAO', 277, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHENBUF05ZHE', 278, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHASENSHA', 279, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNCHAWAN32CHA', 280, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDABDEP21ZHE', 281, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0223BAO', 282, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAGUL3GUA', 283, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSYIR2FOS', 284, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNTAIJUY23TAI', 285, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWKAN407JIN', 286, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWWOY1JIN', 287, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWMAG12JIN', 288, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNNANXUZ0178NAN', 289, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHUHAO101SHA', 290, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNQITYUN13QIT', 291, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHIQIASHI', 292, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEJIN', 293, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWTUA89JIN', 294, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWXUG1JIN', 295, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSBEI01FOS', 296, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONBUG2JIN', 297, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW031BAO', 298, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW007BAO', 299, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUALIH210GUA', 300, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWCOO1577JIN', 301, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0417BAO', 302, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHEFDIE1022HEF', 303, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('VNANBINBAC', 122, 'Alex @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNNANMEIQUA', 305, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAYIB097GUA', 306, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWENNIS15WEN', 307, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWAIX588JIN', 308, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('HKHONKON22YAU', 309, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHOHAN94ZHO', 310, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAYUQ903GUA', 311, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHUJIUSHA', 75, 'Alex @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWANHAN3CHA', 312, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWSHI0212JIN', 313, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUARUN1018GUA', 314, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNJINCOM0341BAO', 315, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSAIR2FOS', 316, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWJUC2JIN', 317, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWCHO0555JIN', 318, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWUJLIX1SUZ', 319, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHEFXIN1211HEF', 320, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('HKSUNCOLKWU', 321, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNMENSEL4HAI', 322, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXIAMIS007ZHO', 323, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWHEQ1JIN', 324, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXIXNEW0103XIA', 325, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('VNMINVIEHAI', 326, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('VNHUNFUN21DAK', 146, 'Alex @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW0001BAO', 328, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWRON0011JIN', 329, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONFUY61JIN', 330, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSQIJ01FOS', 331, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONDUR2JIN', 332, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0427BAO', 333, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWJIX302JIN', 334, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSUZFUM5SUZ', 335, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNNANGAL1558NAN', 336, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHEZHE092ZHE', 337, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIDPIN23YIC', 338, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAMAN614GUA', 339, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUASHE010GUA', 340, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAXIK204GUA', 341, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHICOU13CHI', 342, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONDIS2KUN', 343, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOLIA0072BAO', 344, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONMOU29JIN', 345, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHESHE182SHE', 346, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHECART3002HAN', 347, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOCHE3BAO', 4, 'Alex @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.mid_aliases VALUES ('CNMEETHE61FUZ', 349, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEMIL05SHE', 350, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAOMA006GUA', 351, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWNIT1JIN', 352, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWKEZ2JIN', 353, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNQINLAK606NAN', 354, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHAQIN0096SHA', 355, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHANHOU4HAN', 356, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEQUZ201SHE', 357, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNLINANJIN', 358, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXIUCOU113JIU', 359, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYUEREH4ANQ', 360, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHANMIT0282HAN', 361, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0327BAO', 362, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWLAI1JIN', 363, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWFUWJIN', 364, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOVAL3BAO', 365, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWXID708JIN', 366, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHETRA08GUA', 367, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNJIADIA102NAN', 368, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNMIACOU2HAN', 369, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFUZGUL01FUZ', 370, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHANYUH0550HAN', 371, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAIXIN008BAO', 372, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXINTEX570QIN', 373, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWDUC3JIN', 374, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWPUY2JIN', 375, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNPUJJIA196JIN', 376, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWNIA149JIN', 377, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUIBAO299GUI', 378, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHEGUA121ZHE', 379, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWUHNEW01WUH', 380, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUALON404GUA', 381, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHEMOY1ZHE', 382, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNTIACHA0402TIA', 383, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOBAI001BAO', 384, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNTIAZHE108TIA', 385, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNTAIBORTAI', 386, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHUYIS102SHA', 387, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEULU0070SHE', 388, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHALAN1700SHA', 389, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNNANHAO1409NAN', 390, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONSHI1187DON', 391, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW028BAO', 392, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSUZIND145SUZ', 393, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAMUY0328GUA', 394, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CN**1212JIN', 395, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSUSHUI14HUI', 396, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWSU202JIN', 397, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNJINHUI2QUA', 398, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0141BAO', 399, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSDEC026FOS', 400, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNCENWEI1WUZ', 401, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONYIT1JIN', 402, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHUYUA126ZHU', 403, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEKAI012SHE', 404, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEXIN053SHE', 405, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAXIJ0278GUA', 406, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAQIA043GUA', 407, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWUHWEI02WUH', 408, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYUNTRA03FOS', 409, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSANN1FOS', 410, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSSUM1FOS', 411, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNLEFDEP023LUO', 412, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONJUN116JIN', 413, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUASHI386GUA', 414, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWUHYOU01WUH', 415, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEMAI006SHE', 416, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWPUM13JIN', 417, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWBOD1JIN', 418, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNPUJQIA2JIN', 419, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBEIMIN0319BEI', 420, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWUHDON306WUH', 421, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAYIN614GUA', 422, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWLUS407JIN', 423, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWINT2JIN', 424, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWGAI2JIN', 425, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXIAYIR104XIA', 426, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOHUI0209BAO', 427, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOBAI060BAO', 428, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNPUJTUO201JIN', 429, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNTOUA302JIN', 430, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWKUO401JIN', 431, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWXUA177JIN', 432, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHUCOU09SUQ', 433, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWNAN758JIN', 434, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNCHAWAN0800CHA', 435, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDINSUP05GUA', 436, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0403BAO', 437, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWFUX88JIN', 438, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWFUX3JIN', 439, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNHEBQIB03HEB', 440, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHEZHU026ZHE', 441, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHIHUI210QUA', 442, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNPOYCOU697SHA', 443, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUA5035GUANGZ', 444, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('TRTEKTEK723IST', 445, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNTIAHUA002TIA', 446, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDONMAN0198DON', 447, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAXUA6789GUA', 448, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAYIS7410GUA', 449, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXINCHE2188HUL', 450, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEDEP0468EZH', 451, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWBIN0441JIN', 452, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWPAS27JIN', 453, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSUZYIW5SUZ', 454, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAYIH018LIA', 455, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWFUX606JIN', 456, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWENR4JIN', 457, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNNANLUO048NAN', 458, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSCOO08FOS', 459, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNFOSYAD01FOS', 460, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHEBEA2FOS', 461, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUABAN0806DON', 462, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHIWAL202QUA', 463, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNQINDIS1NAN', 464, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAYAO0211GUA', 465, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWZIL103JIN', 466, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHAYIQ011RIZ', 467, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUANUA2GUA', 468, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWBET3JIN', 469, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAIXIN007BAO', 470, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNQINQIY1QIN', 471, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNXIACIT0201XIA', 472, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0444BAO', 473, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNPUJZHEJIN', 474, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNORCGAR063GUA', 475, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSUZTAI5SUZ', 476, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNTAIYUN025TAI', 477, 'Alex @ JFK', '2025-09-20 16:48:18.781965-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAINA1GUA', 653, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0116BAO', 654, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0236BAO', 655, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNNANCOU206FUZ', 656, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGUAPAN0960GUA', 656, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNJINQIN102JIN', 658, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYANSEN205YAN', 659, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNWENCOU11GUA', 660, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHAYUP314SHA', 661, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNDALWUFHUI', 662, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNZHECHI07GUA', 663, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNSHAZHA562SHA', 664, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNGAOXIN0424BAO', 665, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAOTAO064BAO', 666, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNBAINEW048BAO', 667, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');
INSERT INTO midmap.mid_aliases VALUES ('CNYIWQIH4JIN', 668, 'ALEX @ JFK', '2025-09-20 17:04:44.855023-04');


--
-- TOC entry 4963 (class 0 OID 16708)
-- Dependencies: 222
-- Data for Name: name_mappings; Type: TABLE DATA; Schema: midmap; Owner: -
--

INSERT INTO midmap.name_mappings VALUES ('Jinhua Jindong District Liju Ecommerce Firm', 33, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GanZhouPanHongTechnology', 14, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('LINZHOUJINPENGSHANGMAO CO..LTD.', 37, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('NO.1177,BINHAI, LONGWAN, WENZHOU.', 40, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('XINYUSHIXIANNVHUQUQIANHEBAIHUIZHIXIECHANG', 64, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wenzhoushifengyiwujinzhipin Co., Ltd.', 60, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('XINGCHENGHUIMEICLOTHINGMANUFACTURINGFACTORY', 63, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('FOSHANSHIMMUPINGFUSHI O..LTD.', 11, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Haomiao.electronic.commerce co.,ltd', 24, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('ZHONGQINMAOYIGUANGZHOU CO..LTD', 73, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GUANGZHOUSHILINGLINGQIKEJIFAZHANCO.LTD.', 18, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('NO.5, PETROLEUM ROAD', 41, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('PUJIANG MEMORY TOY CO., LTD', 44, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('JINHUASHIQINRONGMAOYI CO.LTD', 32, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('ANHUI HEYE NETWORK TECHNOLOGY CO., LTD', 1, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHENZHENJIAMIWANGLUOISHUCO..LTD', 48, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHENZHENSHIANRUNTAIKEJICO.LTD.', 47, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GUANGZHOU AICHUANGJINCHUKOUMAOYI CO., LTD.', 20, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Fujian Chengrui Shoes Industry Co. , Ltd.', 13, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('PANAN JINGYA HORTICULTURAL SUPPLIES FACTORY', 42, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('HUAIYUANXINHAODIANZISHANGWU CO.LTD.', 28, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GUANGZHOUTONGRUNTRADINGCO..LTD', 17, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('HUIYU WOMEN''S SHOE FACTORY', 30, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Foshan Shanmu clothing Co., LTD', 12, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('HUIZHOU DUDU PET PRODUCTS CO., ITD', 29, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Hengyang City Coarse Tea and Rice Catering Culture Ltd', 25, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('JINHUAGUOYOUHOMEFURNISHINGCO.LTD', 31, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('TAIZHOUSHIDAHONGBAOGONGYIPIN CO.LTD.', 58, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Foshanshixuntuodianzico.Ltd', 10, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('YIWUSHIYOUKEJINCHUKOUCO.LTD.', 68, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GUANGZHAUYUNNIFUSHICO.LTD.', 16, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('ZHEJIANG MENGDA IMPORT AND EXPORT CO., LTD.', 72, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHENZHENSHIDONGHEXINKEJI.CO,.LTD', 53, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Tan Hai Sinh', 165, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('MOUDING COUNTY KUNI DEPARTMENT STORE SOLE PROPRIETORSHIP', 39, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHANDONGTAHAIWANGLUOKEJI CO.LTD.', 46, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GUANGZHOUHUIWANGDIANZISHANGWUCO..LTD', 19, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Xingcheng Kaisheng Garment Co., Ltd.', 35, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Xingcheng Kaiwei Garment Co., Ltd.', 66, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Xingcheng Kairuida Garment Co', 34, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Dongguan Shanjia Clothing Co., Ltd.', 9, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('DONGMING CO.LTD', 8, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Baoding Chenchuang Trading Co., Ltd.', 6, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Taizhou Borui Industry and Trade Co., Ltd.', 59, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Zhuji Jiuzhi Textile Factory', 75, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Baigou New Town Yaohuo Bags Factory (individual business owner)', 2, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Xinyu Zulu Shoes Co., Ltd.', 67, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Suzhou Tianbianyou Culture Media Co., Ltd.', 57, 'JC @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Huangshi Chaoju Clothing Store, Baiyun District, Guangzhou City', 27, 'ZOEY @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Nan''an Meishan Hesheng Knitting Factory', 38, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Shantou Buyun Clothing Co., Ltd.', 5, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Dongguan Dingyangfeng Fashion Co., Ltd.', 7, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Xingcheng Kairuida Garment Co., Ltd.', 65, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Yueqing Mengfu International Trade Co., Ltd.', 71, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Yiwu Yaqin Electronic Commerce Company (individual business owner)', 70, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Yiwu Yaoer Ecommerce Co., Ltd.', 69, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Shenzhen 85 WinWin Trading Co., Ltd.', 51, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Shenzhen Dechuang Photoelectric Technology Co., Ltd', 56, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Guangzhou Zuomu Trading Co., Ltd.', 23, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Guangzhou Huiya Garment Co., Ltd.', 22, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Yiwu Qiangkuang Ecommerce Store (Individual Business)', 45, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Changge City Zhubao General Store (Individual Business)', 74, 'JW @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GUANGZHOUPEISHANFUZHUANGGONGYINGLIANGUANICO.LTD', 43, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wenzhoushensengongju Co., Ltd.', 55, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GanZhouPanHong Technology Co., LTD', 15, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wenzhouyihewanjuzhizao Co., Ltd.', 61, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Jinhua Jindong District Liju E-commerce Firm', 33, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('GUANGXIPINGNANXIANYUHANKEJI CO..LTD', 21, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHENZHEN BEAUTIFUL STORY TRADING CO., LTD.', 52, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('BANANA TOOTH CLOTHING CO.LTD', 3, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHENZHENJIECHANGSHENGINDUSTRIALCO..LTD', 50, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHENZHENTUOWEIDIANZISHANGWUCO.LTD.', 49, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wenzhouheshengsujiao Co., Ltd.', 26, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wenzhouchangchuangshangmao Co., Ltd.', 62, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('FOSHANBEISHIYUFUSHI CO., LTD.', 11, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SHANDONGSIBANGGONGJU CO.LTD', 66, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('WENZHOUFEIMUCLOTHINGCO.LTD', 62, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('ZHENGZHOUAMIERMAOYI CO.LTD', 54, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('PUJIANGXIANFULIUMANMAOYICO.LTD.', 36, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wenzhoushimikaixieye Co., Ltd.', 62, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('rizhaozhulongfangzhiyouxiangongsi', 54, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('YIWU XINMAN JEWELRY CO. LTD', 4, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wan Ly (Cambodia) Garment Co., Ltd.', 111, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Lonso (Cambodia) Garment Co., Ltd.', 97, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Xundu International Trading Company Limited', 114, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('THAM VAN COMPANY LIMITED', 169, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('New Jing Feng (Cambodia) Garment Co., Ltd.', 100, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Vietnam Shangya Company Limited', 181, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('MB Vietnam Garment Production Trading Service Co., Ltd.', 155, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Gia Phuc Development Production Trading Service Co., Ltd.', 140, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('San Mateo Garment (Cambodia) Co., Ltd.', 105, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Dai Duong Hai Duong Company Limited', 130, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('YINIFU CLOTHING COMPANY LIMITED', 184, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Chan Hung Garment Import-Export Production Co., Ltd.', 127, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('YENI GOLDEN IMPORT EXPORT TRADING COMPANY LIMITED', 183, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Joy Vina Fashion Co., Ltd.', 149, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Yi Lan Ji Garment (Cambodia) Co., Ltd.', 115, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CHAN HUNG IMPORT EXPORT GARMENT PRODUCTION COMPANY LIMITED', 126, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('XIYIN VIETNAM DISTRIBUTION COMPANY LIMITED', 113, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Saigon Garments Co., Ltd.', 161, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Cam Forever Co., Ltd.', 81, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Duy Minh Phat Trading Production Garment Import Export Co., Ltd.', 137, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Rui Wen Aries (Cambodia) Garments Co., Ltd.', 104, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('KHOI NGHIEP GARMENT COMPANY LIMITED', 128, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Joy Rich Garment (Cambodia) Co., Ltd.', 96, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Dai Ma Garment Import-Export Company Limited', 131, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('New Era (Cambodia) Cashmere Textile Co., Ltd.', 99, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Si Xin Underwear Factory', 109, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Shangya Vietnam Co., Ltd.', 164, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thien Hung Phat Factory', 170, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thinh Phong Fashion Company Limited', 172, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Hongruida Garment (Cambodia) Co., Ltd.', 92, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Truong Phat Hanoi Production and Trading Company Limited', 175, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CAO LONG PRODUCTION AND TRADING COMPANY LIMITED', 124, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('BLUE VISTA CO.,LTD.', 78, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Chicbuck (Cambodia) Garments Manufacturing Co., Ltd.', 86, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Active Seamless (Cambodia) Co.,LTD', 76, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Grandfield Industry Co., Ltd.', 91, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Hung Ha Garment Production and Import-Export Co., Ltd.', 147, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('AN VAN PHAT GROUP Co., Ltd.', 179, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Khuong Mai Co., Ltd.', 150, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Foms (Cambodia) Garment Co., Ltd.', 90, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Blue Vista Co., Ltd.', 78, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Global Fashion', 141, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Jinxiu', 95, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Shun Ying Jiu Garment Co., Ltd.', 108, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Nam Phat Import - Export Production Trade JSC', 158, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Aokai Garments Co., Ltd.', 77, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thanh Phat Garment Production and Import-Export Company Limited', 167, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CHENG SHI XIN MANUFACTURINGCOMPANY LIMITED', 85, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Bella Textile Company Limited', 121, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Great New Talent Factory (Cambodia) Co,LTD', 98, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('X Garment Production & Trading Co., Ltd.', 138, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Cam Forever Co., Ltd Garment Factory', 80, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('The Anh Phat Garment Co., Ltd.', 118, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CONG TYTNHH MAY MAC LONGAN QIYUE', 154, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('DONY VIETNAM COMPANY LIMITED', 136, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Yeni Golden Import Export Trading Co., Ltd.', 183, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Huanan Shanggu Apparel (Cambodia) Co., Ltd.', 94, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('BY US Joint Stock Company', 123, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Optima Garment (Cambodia) Co., Ltd.', 101, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('NEW FACE SERVICE TRADING INVESTMENT LIMITED COMPANY', 177, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Truong Thao Garment Joint Stock Company', 176, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CAMBODIAN XIN HUANG MING GARMENT CO.,LTD.', 83, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('APD Garment Manufacturing Limited Company', 119, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SD Global Vina Garment Export Co., Ltd.', 163, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Linglingxiu Clothing Limited', 102, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Indico International Trading and Garment Joint Stock Company', 148, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Dang Minh Phat Fashion Co., Ltd.', 132, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thien Loc Vietnam Import Export Co., Ltd.', 171, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thanh Phat Garment Import-Export Production Co., Ltd.', 167, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('G&G LONG AN FASHION CO., LTD', 139, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Hai Duong Dai Duong Company Limited', 142, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Yuen Tung Clothing Co., Ltd.', 117, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Han Tien Garment Import Export and Production One Member Company Limited', 144, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Fengsheng Garment Factory', 89, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CAMBO VITALITY GARMENT CO., LTD.', 82, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('De Xiang Garment Co., Ltd.', 87, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('ASIA PACIFIC DREAMAX GARMENT(CAMBODIA)CO.,LTD.', 115, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Centric (Cambodia) Garment Co., Ltd.', 84, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Kim Long Garment Co., Ltd.', 152, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('DONGMAO CLOTHING TRADE LIMITED', 135, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('YLD Garment Co., Ltd.', 185, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Xin Hong Peng (Cambodia) Knitting Co., Ltd.', 112, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Cat Tuong Garment Export Co., Ltd.', 125, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Sai Gon Garments Company Limited', 162, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Darwin Fashion Production and Supply Co., Ltd.', 133, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Eternal Fame (Cambodia) Garments Co., Ltd.', 88, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thai Trang Hang Phong Production Trading Co., Ltd.', 168, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thien Phu Fashion Company Limited', 173, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Chuang Yu International Trading Co., Ltd.', 129, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Kim Loi Lai Garment Co.,Ltd', 151, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('TPP Garment One Member Co., Ltd.', 174, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Sunrise Garment Co., Ltd.', 110, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SANTA TAI FACTORY CO., LTD', 106, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Darwin Fashion Production and Supply Company Limited', 134, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('TPP Garment One Member Limited Liability Company', 174, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('MINH DAT – THANH HOA COOPERATIVE', 156, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Regina Miracle International (Vietnam) Co., Ltd.', 160, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Han Tien Garment Import, Export and Production One Member Limited Liability Company', 144, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('RUI SEN JIA GARMENT CO.,LTD.', 103, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Phoenix Vietnam Investment and Production Joint Stock Company', 159, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Wingsburg Vietnam Co., Ltd.', 182, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Minh Viet Phat Trading and Manufacturing Company Limited', 157, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('DANG MINH PHAT FASHION COMPANY', 132, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('AN VAN PHAT GROUP COMPANY LIMITED', 178, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Thai Binh Tue Com Co., Ltd.', 166, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Bach Thinh', 120, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('DANG MINH PHAT FASHION COMPANY LIMITED', 132, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('LEE FASHION TRADING AND PRODUCTION COMPANY LIMITED', 153, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('PROGRESSIVE GARMENT CO.,LTD', 79, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('YOUNG2', 116, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('VIET HAN SJC GARMENT COMPANY LIMITED', 180, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('AN BINH BG GARMENT COMPANY LIMITED', 122, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('HUNG FUNG GARMENT (VIETNAM) CO., LTD', 146, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Hanjie Garment Co., Ltd.', 143, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SAN XUAT AND THUONG MAI TRUONG PHAT HA NOI COMPANY LIMITED.', 175, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Chuangye Garment Co., Ltd.', 128, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Rui Sen Factory', 102, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Active Seamless (Cambodia) Garment Co., Ltd.', 76, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Long An Qiyue Garment Co., Ltd.', 154, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('G&G Long An Fashion Production Trading One Member Co., Ltd.', 139, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Kim Loi Lai Garment Co., Ltd.', 151, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('H.S.XPRINTINGEMBROIDERYCO.,LTD.', 93, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('Busheng Garment Co., Ltd.', 79, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('HNT Garment Import Export Limited Company', 145, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CHENG SHI XIN MANUFACTURING（CAMBODIA）COMPANY LIMITED', 85, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('CAMBO VITALITY GARMENT CO.. LTD', 82, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');
INSERT INTO midmap.name_mappings VALUES ('SANTA TAI FACTORY CO., LTD.', 107, 'Cheng @ JFK', '2025-09-20 16:39:48.971788-04');


--
-- TOC entry 4976 (class 0 OID 0)
-- Dependencies: 226
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: midmap; Owner: -
--

SELECT pg_catalog.setval('midmap.branches_id_seq', 9, true);


--
-- TOC entry 4977 (class 0 OID 0)
-- Dependencies: 219
-- Name: canonical_manufacturers_id_seq; Type: SEQUENCE SET; Schema: midmap; Owner: -
--

SELECT pg_catalog.setval('midmap.canonical_manufacturers_id_seq', 668, true);


--
-- TOC entry 4978 (class 0 OID 0)
-- Dependencies: 223
-- Name: change_log_id_seq; Type: SEQUENCE SET; Schema: midmap; Owner: -
--

SELECT pg_catalog.setval('midmap.change_log_id_seq', 40, true);


--
-- TOC entry 4807 (class 2606 OID 16755)
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- TOC entry 4809 (class 2606 OID 16757)
-- Name: branches branches_station_key; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.branches
    ADD CONSTRAINT branches_station_key UNIQUE (station);


--
-- TOC entry 4788 (class 2606 OID 16692)
-- Name: canonical_manufacturers canonical_manufacturers_good_mid_key; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.canonical_manufacturers
    ADD CONSTRAINT canonical_manufacturers_good_mid_key UNIQUE (good_mid);


--
-- TOC entry 4790 (class 2606 OID 16690)
-- Name: canonical_manufacturers canonical_manufacturers_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.canonical_manufacturers
    ADD CONSTRAINT canonical_manufacturers_pkey PRIMARY KEY (id);


--
-- TOC entry 4798 (class 2606 OID 16731)
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- TOC entry 4786 (class 2606 OID 16679)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (importer_id);


--
-- TOC entry 4793 (class 2606 OID 16701)
-- Name: mid_aliases mid_aliases_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.mid_aliases
    ADD CONSTRAINT mid_aliases_pkey PRIMARY KEY (bad_mid);


--
-- TOC entry 4796 (class 2606 OID 16715)
-- Name: name_mappings name_mappings_pkey; Type: CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.name_mappings
    ADD CONSTRAINT name_mappings_pkey PRIMARY KEY (manufacturer_name);


--
-- TOC entry 4799 (class 1259 OID 16734)
-- Name: idx_changelog_branch; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_branch ON midmap.change_log USING btree (arrival_airport);


--
-- TOC entry 4800 (class 1259 OID 16736)
-- Name: idx_changelog_changed_at; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_changed_at ON midmap.change_log USING btree (changed_at DESC);


--
-- TOC entry 4801 (class 1259 OID 16732)
-- Name: idx_changelog_client; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_client ON midmap.change_log USING btree (client_name);


--
-- TOC entry 4802 (class 1259 OID 16733)
-- Name: idx_changelog_eta; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_eta ON midmap.change_log USING btree (arrival_date);


--
-- TOC entry 4803 (class 1259 OID 16737)
-- Name: idx_changelog_group; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_group ON midmap.change_log USING btree (arrival_date, airline_3d, master_bill_no);


--
-- TOC entry 4804 (class 1259 OID 16735)
-- Name: idx_changelog_key; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_changelog_key ON midmap.change_log USING btree (airline_3d, master_bill_no);


--
-- TOC entry 4791 (class 1259 OID 16707)
-- Name: idx_mid_aliases_good; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_mid_aliases_good ON midmap.mid_aliases USING btree (good_manufacturer_id);


--
-- TOC entry 4794 (class 1259 OID 16721)
-- Name: idx_name_mappings_good; Type: INDEX; Schema: midmap; Owner: -
--

CREATE INDEX idx_name_mappings_good ON midmap.name_mappings USING btree (good_manufacturer_id);


--
-- TOC entry 4805 (class 1259 OID 16785)
-- Name: ux_change_log_unique_change; Type: INDEX; Schema: midmap; Owner: -
--

CREATE UNIQUE INDEX ux_change_log_unique_change ON midmap.change_log USING btree (arrival_date, airline_3d, NULLIF(btrim(master_bill_no), ''::text), upper(NULLIF(btrim(arrival_airport), ''::text)), NULLIF(btrim(client_name), ''::text), upper(NULLIF(btrim(bad_mid), ''::text)), upper(NULLIF(btrim(good_mid), ''::text))) WHERE ((bad_mid IS NOT NULL) AND (good_mid IS NOT NULL));


--
-- TOC entry 4810 (class 2606 OID 16702)
-- Name: mid_aliases mid_aliases_good_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.mid_aliases
    ADD CONSTRAINT mid_aliases_good_manufacturer_id_fkey FOREIGN KEY (good_manufacturer_id) REFERENCES midmap.canonical_manufacturers(id) ON DELETE RESTRICT;


--
-- TOC entry 4811 (class 2606 OID 16716)
-- Name: name_mappings name_mappings_good_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: midmap; Owner: -
--

ALTER TABLE ONLY midmap.name_mappings
    ADD CONSTRAINT name_mappings_good_manufacturer_id_fkey FOREIGN KEY (good_manufacturer_id) REFERENCES midmap.canonical_manufacturers(id) ON DELETE RESTRICT;


-- Completed on 2025-09-21 12:43:03

--
-- PostgreSQL database dump complete
--


