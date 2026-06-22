"""
keyword_scan.py — daily competitor keyword scan.

Runs after seo_check.py. For each tracked page it:
  1. reads that day's top-10 ranking competitors from reports/<date>.json,
  2. fetches each competitor page + Avana's target page,
  3. counts a fixed, curated list of SEO keywords on each page,
  4. accumulates the result into reports/keyword-history.json (keyed by day),
  5. regenerates reports/keyword-history.js (window.KEYWORD_HISTORY) for the
     *-improvements.html pages to render.

Because the top-10 changes day to day, each day's scan stores its own column
set (the sites that ranked that day). The keyword ROWS are fixed per page so
history stays comparable. Avana's target page is always added as a reference
column even when it is not ranking.
"""
import requests
import json
import os
import re
import glob
import time
import html as htmllib
import unicodedata
from datetime import datetime
from urllib.parse import urlparse, quote
from zoneinfo import ZoneInfo

MIAMI = ZoneInfo("America/New_York")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Polite pause between HTTP requests so we don't hammer a host (and trip its
# rate-limiting / bot blocking). Sequential fetches, so this paces the whole run.
REQUEST_DELAY = 1.5     # seconds between consecutive fetches

# Domains with no comparable on-page content (social / video) — skipped.
SKIP_DOMAINS = ("youtube.com", "instagram.com", "facebook.com", "tiktok.com",
                "twitter.com", "x.com", "pinterest.com")

# ── Curated keyword sets (display label -> accent-free match variants) ────────
BREAST_EN = [
    ("breast augmentation", ["breast augmentation"]),
    ("breast implants", ["breast implants", "breast implant"]),
    ("breast augmentation miami", ["breast augmentation miami", "miami breast augmentation"]),
    ("breast implants miami", ["breast implants miami", "breast implant miami"]),
    ("breast lift", ["breast lift"]),
    ("breast enhancement", ["breast enhancement"]),
    ("gummy bear implants", ["gummy bear implants", "gummy bear breast implants"]),
    ("silicone implants", ["silicone implants", "silicone breast implants", "silicone gel implants"]),
    ("saline implants", ["saline implants", "saline breast implants"]),
    ("capsular contracture", ["capsular contracture"]),
    ("implant placement", ["implant placement"]),
    ("implant size", ["implant size", "breast size"]),
    ("breast augmentation cost", ["breast augmentation cost", "augmentation cost", "cost of breast augmentation"]),
    ("breast implants cost", ["breast implants cost", "breast implant cost", "cost of breast implants", "how much are breast implants"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
    ("breast augmentation near me", ["breast augmentation near me", "breast implants near me", "breast augmentation surgeon near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BIR_EN = [
    ("breast implant revision", ["breast implant revision", "implant revision"]),
    ("breast implant revision miami", ["breast implant revision miami", "miami breast implant revision"]),
    ("breast implant revision cost", ["breast implant revision cost", "breast revision cost", "cost of breast implant revision", "how much is breast revision"]),
    ("breast revision miami", ["breast revision miami", "breast revision in miami", "miami breast revision"]),
    ("breast revision surgery miami", ["breast revision surgery miami", "revisional breast surgery miami", "revision breast surgery miami"]),
    ("breast augmentation revision miami", ["breast augmentation revision miami", "revision breast augmentation miami"]),
    ("breast revision surgeon miami", ["breast revision surgeon miami", "best breast revision miami"]),
    ("capsular contracture miami", ["capsular contracture miami", "capsular contracture treatment miami"]),
    ("breast implant removal miami", ["breast implant removal miami", "implant removal miami", "breast implant exchange/removal miami"]),
    ("breast implant exchange miami", ["breast implant exchange miami", "implant exchange miami", "miami implant exchange"]),
    ("breast implant replacement miami", ["breast implant replacement miami", "breast implant replacement south miami"]),
    ("en bloc capsulectomy miami", ["en bloc capsulectomy miami", "en bloc capsulectomy"]),
    ("explant surgery miami", ["explant surgery miami", "explant miami"]),
    ("breast augmentation", ["breast augmentation"]),
    ("breast lift", ["breast lift"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
    ("breast implant revision near me", ["breast implant revision near me", "breast revision near me", "breast implant removal near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BREAST_ES = [
    ("aumento de senos", ["aumento de senos"]),
    ("aumento de senos en miami", ["aumento de senos en miami", "aumento de senos miami"]),
    ("aumento de senos precio", ["aumento de senos precio", "precio de aumento de senos", "costo de aumento de senos", "cuanto cuesta un aumento de senos", "precio de implantes de senos", "costo de implantes mamarios"]),
    ("implantes de senos", ["implantes de senos", "implante de senos"]),
    ("implantes mamarios", ["implantes mamarios", "implante mamario"]),
    ("implantes de silicona", ["implantes de silicona", "implante de silicona", "gel de silicona"]),
    ("implantes salinos", ["implantes salinos", "solucion salina", "implantes de solucion salina"]),
    ("levantamiento de senos", ["levantamiento de senos"]),
    ("reduccion de senos", ["reduccion de senos"]),
    ("contractura capsular", ["contractura capsular"]),
    ("tejido mamario", ["tejido mamario"]),
    ("transferencia de grasa", ["transferencia de grasa"]),
    ("colocacion de implantes", ["colocacion de implantes", "colocacion de los implantes"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("aumento de senos cerca de mi", ["aumento de senos cerca de mi", "implantes de senos cerca de mi", "cirujano plastico cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BIR_ES = [
    ("revision de implantes de senos", ["revision de implantes de senos", "revision de implantes mamarios", "revision de implantes"]),
    ("revision de implantes de senos en miami", ["revision de implantes de senos en miami", "revision de implantes mamarios miami", "revision de implantes de senos miami"]),
    ("revision mamaria miami", ["revision mamaria miami", "revision de senos miami", "revision de senos", "revision de senos south miami"]),
    ("cambio de implantes mamarios miami", ["cambio de implantes mamarios miami", "cambio de implantes mamarios", "cambio de implantes", "cambio de implantes mamarios aventura"]),
    ("extraccion de implantes mamarios miami", ["extraccion de implantes mamarios miami", "extraccion de implantes mamarios", "extraccion de implantes mamarios south miami", "extraccion de implantes"]),
    ("retiro de implantes mamarios", ["retiro de implantes mamarios", "remover implantes mamarios", "quitar implantes mamarios", "explante mamario"]),
    ("contractura capsular", ["contractura capsular"]),
    ("capsulectomia", ["capsulectomia"]),
    ("ruptura de implante", ["ruptura de implante", "fuga de implante", "implante roto"]),
    ("implantes de senos en miami", ["implantes de senos en miami", "implantes mamarios miami", "implantes mamarios en miami"]),
    ("aumento de senos en miami", ["aumento de senos en miami", "aumento de senos miami", "aumento de senos"]),
    ("levantamiento de senos", ["levantamiento de senos"]),
    ("implantes de silicona", ["implantes de silicona", "implantes salinos", "gel de silicona"]),
    ("costo de revision de implantes de senos", ["costo de revision de implantes de senos", "precio de revision de senos", "cuanto cuesta una revision de senos", "costo de revision de implantes mamarios"]),
    ("cirujano plastico certificado", ["cirujano plastico certificado", "cirujanos plasticos certificados"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirugia estetica", ["cirugia estetica"]),
    ("revision de implantes cerca de mi", ["revision de implantes cerca de mi", "revision de senos cerca de mi", "extraccion de implantes cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BR_EN = [
    ("breast reduction", ["breast reduction", "reduction mammoplasty", "mammoplasty"]),
    ("breast reduction miami", ["breast reduction miami", "miami breast reduction", "breast reduction in miami"]),
    ("breast reduction surgery miami", ["breast reduction surgery miami", "breast reduction surgery in miami", "breast reduction surgery"]),
    ("breast reduction cost", ["breast reduction cost", "cost of breast reduction", "how much is a breast reduction", "how much does a breast reduction cost", "how much is breast reduction surgery"]),
    ("breast reduction cost miami", ["breast reduction cost miami", "breast reduction miami cost", "miami breast reduction cost", "breast reduction surgery cost miami"]),
    ("breast reduction miami beach", ["breast reduction miami beach", "best breast reduction miami beach"]),
    ("best breast reduction miami", ["best breast reduction miami"]),
    ("male breast reduction miami", ["male breast reduction miami", "male breast reduction", "gynecomastia miami"]),
    ("breast reduction insurance miami", ["breast reduction insurance miami", "breast reduction insurance", "does insurance cover breast reduction", "breast reduction insurance miramar"]),
    ("scarless breast reduction miami", ["scarless breast reduction miami", "scarless breast reduction"]),
    ("breast reduction recovery", ["breast reduction recovery", "breast reduction surgery recovery"]),
    ("breast lift", ["breast lift", "breast lift miami"]),
    ("breast augmentation", ["breast augmentation"]),
    ("mammoplasty miami", ["mammoplasty miami"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
    ("breast reduction near me", ["breast reduction near me", "breast reduction surgeon near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BL_EN = [
    ("breast lift", ["breast lift", "mastopexy", "boob lift", "breast uplift"]),
    ("breast lift miami", ["breast lift miami", "miami breast lift", "breast lift in miami", "breast lift miami fl", "breast lift miami florida"]),
    ("breast lift cost", ["breast lift cost", "cost of breast lift", "how much is a breast lift", "how much does a breast lift cost", "breast lift price"]),
    ("breast lift miami cost", ["breast lift miami cost", "breast lift cost miami", "cost of breast lift miami", "miami breast lift cost", "breast lift price miami", "breast lift miami pricing"]),
    ("best breast lift miami", ["best breast lift miami", "best breast lift miami beach", "best breast lift doctor in miami"]),
    ("breast lift miami beach", ["breast lift miami beach", "breast lift miami beach fl"]),
    ("breast lift with implants miami", ["breast lift with implants miami", "breast lift with augmentation miami", "breast augmentation with lift miami", "breast lift augmentation miami", "miami breast lift with implants"]),
    ("mastopexy miami", ["mastopexy miami", "mastopexy cost", "mastopexy near me", "mastopexy florida"]),
    ("scarless breast lift", ["scarless breast lift", "scarless breast lift florida", "breast lift without scars florida"]),
    ("breast lift recovery", ["breast lift recovery", "recovery after a breast lift in miami"]),
    ("breast augmentation miami", ["breast augmentation miami", "miami breast augmentation"]),
    ("breast reduction miami", ["breast reduction miami"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
    ("breast lift near me", ["breast lift near me", "breast lift surgeon near me", "mastopexy near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
RDS_ES = [
    ("reduccion de senos", ["reduccion de senos", "reduccion de mamas", "reduccion mamaria"]),
    ("reduccion de senos en miami", ["reduccion de senos en miami", "reduccion de senos miami", "reduccion mamaria miami"]),
    ("reduccion de senos costo", ["reduccion de senos costo", "costo de reduccion de senos", "cuanto cuesta una reduccion de senos", "cuanto vale una reduccion de senos"]),
    ("reduccion de senos precio", ["reduccion de senos precio", "precio de reduccion de senos", "precio reduccion de senos", "reduccion de mamas valor"]),
    ("cuanto cuesta una reduccion de senos en miami", ["cuanto cuesta una reduccion de senos en miami", "cuanto cuesta una operacion de senos en miami"]),
    ("cuanto cuesta una reduccion de senos en usa", ["cuanto cuesta una reduccion de senos en usa", "cuanto cuesta una reduccion de senos en estados unidos", "reduccion de senos precio estados unidos"]),
    ("mamoplastia de reduccion", ["mamoplastia de reduccion", "mamoplastia de reduccion precio", "cirugia de reduccion de mamas"]),
    ("cirugia de reduccion de senos", ["cirugia de reduccion de senos", "cirugia de reduccion de senos precio"]),
    ("seguro reduccion de senos", ["seguro reduccion de senos", "reduccion de senos seguro medico", "reduccion de senos cubierta por seguro"]),
    ("financiamiento reduccion de senos", ["financiamiento reduccion de senos", "reduccion de senos financiamiento"]),
    ("levantamiento de senos", ["levantamiento de senos", "levantamiento de senos miami"]),
    ("aumento de senos", ["aumento de senos", "aumento de senos miami"]),
    ("cirujano plastico certificado", ["cirujano plastico certificado", "cirujanos plasticos certificados"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirugia estetica", ["cirugia estetica"]),
    ("reduccion de senos cerca de mi", ["reduccion de senos cerca de mi", "reduccion de mamas cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
LEV_ES = [
    ("levantamiento de senos", ["levantamiento de senos", "mastopexia", "elevacion de mama", "levantamiento de busto", "levantamiento de pecho"]),
    ("levantamiento de senos en miami", ["levantamiento de senos en miami", "levantamiento de senos miami", "elevacion de mama en miami", "levantamiento de senos south miami"]),
    ("levantamiento de senos precio", ["levantamiento de senos precio", "precio de levantamiento de senos", "cuanto cuesta levantar los senos", "cuanto cuesta un levantamiento de senos en miami"]),
    ("levantamiento de senos sin implantes precio", ["levantamiento de senos sin implantes precio", "levantamiento de senos sin implantes", "precio de levantamiento de senos sin implantes", "levantamiento de busto sin implantes precio"]),
    ("levantamiento de senos sin cirugia", ["levantamiento de senos sin cirugia", "senos levantados sin cirugia", "levantamiento de senos con hilos tensores precio"]),
    ("levantamiento de senos sin cicatriz", ["levantamiento de senos sin cicatriz", "levantamiento de senos con laser", "levantamiento de senos con láser"]),
    ("aumento de senos con levantamiento", ["aumento de senos con levantamiento", "aumento de senos con levantamiento miami", "aumento de senos con levantamiento aventura", "levantamiento de senos con implantes"]),
    ("levantamiento de senos aventura", ["levantamiento de senos aventura", "levantamiento de senos fort lauderdale", "levantamiento de senos draper"]),
    ("correccion de pezones miami", ["correccion de pezones miami", "correccion de pezones invertidos miami", "correccion de pezones south miami"]),
    ("cirugia de levantamiento de senos", ["cirugia de levantamiento de senos", "operacion levantamiento de senos", "cirugia en t senos"]),
    ("reduccion de senos miami", ["reduccion de senos miami"]),
    ("aumento de senos miami", ["aumento de senos miami", "aumento de senos en miami"]),
    ("cirujano plastico certificado", ["cirujano plastico certificado", "cirujanos plasticos certificados"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirugia estetica", ["cirugia estetica"]),
    ("levantamiento de senos cerca de mi", ["levantamiento de senos cerca de mi", "mastopexia cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BBL_EN = [
    ("brazilian butt lift", ["brazilian butt lift"]),
    ("brazilian butt lift miami", ["brazilian butt lift miami"]),
    ("brazilian butt lift cost", ["brazilian butt lift cost", "bbl cost", "cost of a bbl", "cost of bbl", "how much is a bbl", "how much does a bbl cost"]),
    ("bbl", ["bbl"]),
    ("butt lift", ["butt lift"]),
    ("butt augmentation", ["butt augmentation", "buttock augmentation"]),
    ("butt implants", ["butt implants", "buttock implants"]),
    ("fat transfer", ["fat transfer"]),
    ("fat grafting", ["fat grafting", "fat graft"]),
    ("skinny bbl", ["skinny bbl"]),
    ("bbl surgery", ["bbl surgery"]),
    ("liposuction", ["liposuction"]),
    ("tummy tuck", ["tummy tuck"]),
    ("breast augmentation", ["breast augmentation"]),
    ("body contouring", ["body contouring"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("bbl near me", ["bbl near me", "brazilian butt lift near me", "butt lift near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BBL_ES = [
    ("levantamiento de gluteos brasileno", ["levantamiento de gluteos brasileno"]),
    ("aumento de gluteos", ["aumento de gluteos"]),
    ("bbl", ["bbl"]),
    ("cirugia bbl", ["cirugia bbl", "procedimiento bbl"]),
    ("precio de bbl", ["precio de bbl", "bbl precio", "costo de bbl", "cuanto cuesta un bbl", "precio de aumento de gluteos", "costo de aumento de gluteos"]),
    ("transferencia de grasa", ["transferencia de grasa"]),
    ("injerto de grasa", ["injerto de grasa", "injerto graso"]),
    ("implantes de gluteos", ["implantes de gluteos", "implante de gluteos"]),
    ("liposuccion", ["liposuccion"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("aumento de senos", ["aumento de senos"]),
    ("levantamiento de senos", ["levantamiento de senos"]),
    ("contorno corporal", ["contorno corporal"]),
    ("lifting facial", ["lifting facial"]),
    ("prenda de compresion", ["prenda de compresion", "prendas de compresion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("bbl cerca de mi", ["bbl cerca de mi", "levantamiento de gluteos cerca de mi", "aumento de gluteos cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BBL_REVISION_EN = [
    ("bbl revision", ["bbl revision", "revision bbl"]),
    ("bbl revision miami", ["bbl revision miami", "revision bbl miami"]),
    ("brazilian butt lift revision", ["brazilian butt lift revision"]),
    ("bbl reversal", ["bbl reversal", "bbl reversal miami"]),
    ("bbl reduction", ["bbl reduction", "bbl reduction miami"]),
    ("second bbl", ["second bbl", "2nd bbl", "second round bbl", "round 2 bbl"]),
    ("revision butt augmentation", ["revision butt augmentation", "butt augmentation revision"]),
    ("bbl revision cost", ["bbl revision cost", "cost of bbl revision"]),
    ("bbl revision before and after", ["bbl revision before and after"]),
    ("brazilian butt lift", ["brazilian butt lift"]),
    ("bbl", ["bbl"]),
    ("butt augmentation", ["butt augmentation", "buttock augmentation"]),
    ("fat transfer", ["fat transfer"]),
    ("fat grafting", ["fat grafting", "fat graft"]),
    ("liposuction", ["liposuction"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
    ("bbl revision near me", ["bbl revision near me", "brazilian butt lift revision near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
BBL_REVISION_ES = [
    ("revision de bbl", ["revision de bbl", "revision bbl"]),
    ("revision de bbl en miami", ["revision de bbl en miami", "revision bbl miami"]),
    ("revision de levantamiento de gluteos", ["revision de levantamiento de gluteos", "revision de aumento de gluteos"]),
    ("segunda ronda de bbl", ["segunda ronda de bbl", "segundo bbl", "segunda cirugia de bbl"]),
    ("bbl en español", ["bbl en espanol", "que es bbl en espanol"]),
    ("que significa bbl", ["que significa bbl", "que es bbl"]),
    ("levantamiento de gluteos brasileno", ["levantamiento de gluteos brasileno", "aumento de gluteos brasileno"]),
    ("aumento de gluteos", ["aumento de gluteos"]),
    ("bbl", ["bbl"]),
    ("precio de bbl", ["precio de bbl", "bbl precio", "cuanto cuesta un bbl", "costo de bbl"]),
    ("transferencia de grasa", ["transferencia de grasa"]),
    ("injerto de grasa", ["injerto de grasa", "injerto graso"]),
    ("implantes de gluteos", ["implantes de gluteos", "implante de gluteos"]),
    ("liposuccion", ["liposuccion"]),
    ("prenda de compresion", ["prenda de compresion", "faja"]),
    ("cirujano plastico certificado", ["cirujano plastico certificado", "cirujanos plasticos certificados"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirugia estetica", ["cirugia estetica"]),
    ("revision de bbl cerca de mi", ["revision de bbl cerca de mi", "revision de gluteos cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
LIPO_EN = [
    ("lipo 360", ["lipo 360"]),
    ("lipo 360 miami", ["lipo 360 miami"]),
    ("lipo 360 cost", ["lipo 360 cost", "lipo 360 miami cost", "cost of lipo 360", "how much is lipo 360"]),
    ("liposuction 360", ["liposuction 360", "360 liposuction"]),
    ("liposuction", ["liposuction"]),
    ("body contouring", ["body contouring"]),
    ("tummy tuck", ["tummy tuck"]),
    ("brazilian butt lift", ["brazilian butt lift", "bbl"]),
    ("abdominal etching", ["abdominal etching", "ab etching"]),
    ("love handles", ["love handles"]),
    ("flanks", ["flanks", "flank"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("excess fat", ["excess fat"]),
    ("fat removal", ["fat removal", "remove fat", "removes fat", "removing fat"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("lipo 360 near me", ["lipo 360 near me", "liposuction 360 near me", "lipo near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
LIPO_ES = [
    ("lipo 360", ["lipo 360"]),
    ("lipo 360 miami", ["lipo 360 miami"]),
    ("precio de lipo 360", ["precio de lipo 360", "lipo 360 precio", "costo de lipo 360", "cuanto cuesta una lipo 360"]),
    ("liposuccion 360", ["liposuccion 360", "360 liposuccion"]),
    ("liposuccion", ["liposuccion"]),
    ("contorno corporal", ["contorno corporal"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("levantamiento de gluteos", ["levantamiento de gluteos", "bbl"]),
    ("prenda de compresion", ["prenda de compresion", "prendas de compresion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("lipo 360 cerca de mi", ["lipo 360 cerca de mi", "liposuccion 360 cerca de mi", "liposuccion cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
MMO_EN = [
    ("mommy makeover", ["mommy makeover"]),
    ("mommy makeover miami", ["mommy makeover miami", "miami mommy makeover"]),
    ("mommy makeover cost", ["mommy makeover cost", "cost of mommy makeover", "cost of a mommy makeover"]),
    ("tummy tuck", ["tummy tuck"]),
    ("abdominoplasty", ["abdominoplasty"]),
    ("breast augmentation", ["breast augmentation"]),
    ("breast lift", ["breast lift"]),
    ("breast implants", ["breast implants", "breast implant"]),
    ("liposuction", ["liposuction"]),
    ("brazilian butt lift", ["brazilian butt lift", "bbl"]),
    ("fat transfer", ["fat transfer"]),
    ("body contouring", ["body contouring"]),
    ("diastasis recti", ["diastasis recti", "abdominal separation", "muscle separation"]),
    ("post pregnancy", ["post pregnancy", "after pregnancy", "post-pregnancy"]),
    ("c section", ["c section", "c-section", "cesarean"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
    ("mommy makeover near me", ["mommy makeover near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]
MMO_ES = [
    ("mommy makeover", ["mommy makeover"]),
    ("mommy makeover en miami", ["mommy makeover en miami", "mommy makeover miami"]),
    ("cambio de imagen para mamas", ["cambio de imagen para mamas", "cambio de imagen de mama", "cambio de imagen para mama"]),
    ("mommy makeover precio", ["mommy makeover precio", "precio de mommy makeover", "precio del mommy makeover"]),
    ("cuanto cuesta un mommy makeover", ["cuanto cuesta un mommy makeover", "cuanto cuesta el mommy makeover", "cuanto cuesta una mommy makeover"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("aumento de senos", ["aumento de senos"]),
    ("levantamiento de senos", ["levantamiento de senos"]),
    ("liposuccion", ["liposuccion"]),
    ("transferencia de grasa", ["transferencia de grasa"]),
    ("contorno corporal", ["contorno corporal"]),
    ("diastasis", ["diastasis", "separacion abdominal", "separacion de los musculos"]),
    ("despues del parto", ["despues del parto", "posparto", "post parto"]),
    ("financiamiento", ["financiamiento", "financiacion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia estetica", ["cirugia estetica"]),
    ("mommy makeover cerca de mi", ["mommy makeover cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]

LIPOSUCTION_EN = [
    ("liposuction", ["liposuction"]),
    ("liposuction miami", ["liposuction miami", "miami liposuction"]),
    ("liposuction cost", ["liposuction cost", "liposuction miami cost", "cost of liposuction", "how much is liposuction"]),
    ("lipo", ["lipo"]),
    ("lipo miami", ["lipo miami", "miami lipo"]),
    ("lipo 360", ["lipo 360", "360 liposuction", "liposuction 360"]),
    ("laser liposuction", ["laser liposuction", "laser lipo"]),
    ("vaser liposuction", ["vaser liposuction", "vaser lipo"]),
    ("high definition liposuction", ["high definition liposuction", "hd liposuction", "hd lipo", "hi def lipo"]),
    ("chin liposuction", ["chin liposuction", "submental liposuction", "neck liposuction"]),
    ("liposculpture", ["liposculpture", "lipo sculpting"]),
    ("tummy tuck", ["tummy tuck"]),
    ("body contouring", ["body contouring"]),
    ("fat removal", ["fat removal", "remove fat", "fat reduction"]),
    ("compression garment", ["compression garment", "compression garments"]),
    ("board certified plastic surgeon", ["board certified plastic surgeon", "board certified plastic surgeons"]),
    ("plastic surgeon", ["plastic surgeon", "plastic surgeons"]),
    ("plastic surgery", ["plastic surgery"]),
    ("cosmetic surgery", ["cosmetic surgery"]),
    ("liposuction near me", ["liposuction near me", "lipo near me", "liposuction surgeon near me"]),
    ("miami fl / florida", ["miami", "miami fl", "miami florida", "south florida"]),
    ("miami neighborhoods", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]

LIPOSUCCION_ES = [
    ("liposuccion", ["liposuccion"]),
    ("liposuccion en miami", ["liposuccion en miami", "liposuccion miami", "liposuccion en miami florida"]),
    ("lipoescultura", ["lipoescultura", "lipo escultura"]),
    ("liposuccion precio", ["liposuccion precio", "precio de liposuccion", "precio liposuccion"]),
    ("cuanto cuesta una lipo", ["cuanto cuesta una lipo", "cuanto cuesta una liposuccion", "cuanto cuesta la lipo"]),
    ("lipo 360", ["lipo 360", "liposuccion 360"]),
    ("lipotransferencia", ["lipotransferencia", "transferencia de grasa"]),
    ("liposuccion laser", ["liposuccion laser", "lipolaser", "lipo laser"]),
    ("alta definicion", ["liposuccion de alta definicion", "alta definicion", "lipo hd"]),
    ("liposuccion de brazos", ["liposuccion de brazos", "lipo de brazos"]),
    ("abdominoplastia", ["abdominoplastia"]),
    ("contorno corporal", ["contorno corporal"]),
    ("lipopapada", ["lipopapada", "liposuccion de papada"]),
    ("financiamiento", ["financiamiento", "financiacion"]),
    ("cirugia plastica", ["cirugia plastica"]),
    ("cirujano plastico", ["cirujano plastico", "cirujanos plasticos"]),
    ("cirugia estetica", ["cirugia estetica"]),
    ("liposuccion cerca de mi", ["liposuccion cerca de mi", "lipo cerca de mi", "lipoescultura cerca de mi"]),
    ("miami florida", ["miami", "miami florida", "miami fl", "sur de la florida", "sur de florida"]),
    ("barrios de miami", ["miami beach", "south miami", "north miami", "north miami beach", "miami lakes", "miami gardens", "miami shores", "miami springs", "west miami", "downtown miami", "key biscayne", "aventura", "coral gables", "doral", "kendall", "hialeah", "brickell", "pinecrest", "coconut grove", "wynwood", "sunny isles", "bal harbour", "cutler bay", "palmetto bay", "homestead", "weston", "fort lauderdale", "hollywood", "pembroke pines", "miramar"]),
]

# target_url -> {slug (improvements page), lang, keyword set}
PAGES = {
    "https://avanaplasticsurgery.com/brazilian-butt-lift-miami":
        {"slug": "brazilian-butt-lift-miami", "lang": "en", "kw": BBL_EN},
    "https://avanaplasticsurgery.com/bbl-revision-miami":
        {"slug": "bbl-revision-miami", "lang": "en", "kw": BBL_REVISION_EN},
    "https://avanaplasticsurgery.com/espanol/revision-de-bbl-en-miami":
        {"slug": "revision-de-bbl-en-miami", "lang": "es", "kw": BBL_REVISION_ES},
    "https://avanaplasticsurgery.com/espanol/levantamiento-de-gluteos-en-miami":
        {"slug": "levantamiento-de-gluteos-en-miami", "lang": "es", "kw": BBL_ES},
    "https://avanaplasticsurgery.com/lipo-360-miami":
        {"slug": "lipo-360-miami", "lang": "en", "kw": LIPO_EN},
    "https://avanaplasticsurgery.com/espanol/lipo-360-en-miami":
        {"slug": "liposuccion-360-en-miami", "lang": "es", "kw": LIPO_ES},
    "https://avanaplasticsurgery.com/breast-implants-miami":
        {"slug": "breast-implants-miami", "lang": "en", "kw": BREAST_EN},
    "https://avanaplasticsurgery.com/breast-augmentation-miami":
        {"slug": "breast-augmentation-miami", "lang": "en", "kw": BREAST_EN},
    "https://avanaplasticsurgery.com/breast-implant-revision-miami":
        {"slug": "breast-implant-revision-miami", "lang": "en", "kw": BIR_EN},
    "https://avanaplasticsurgery.com/breast-reduction-miami":
        {"slug": "breast-reduction-miami", "lang": "en", "kw": BR_EN},
    "https://avanaplasticsurgery.com/breast-lift-miami":
        {"slug": "breast-lift-miami", "lang": "en", "kw": BL_EN},
    "https://avanaplasticsurgery.com/espanol/reduccion-de-senos-miami":
        {"slug": "reduccion-de-senos-miami", "lang": "es", "kw": RDS_ES},
    "https://avanaplasticsurgery.com/espanol/levantamiento-de-senos-en-miami":
        {"slug": "levantamiento-de-senos-en-miami", "lang": "es", "kw": LEV_ES},
    "https://avanaplasticsurgery.com/espanol/revision-de-implantes-de-senos-en-miami":
        {"slug": "revision-de-implantes-de-senos-en-miami", "lang": "es", "kw": BIR_ES},
    "https://avanaplasticsurgery.com/espanol/implantes-de-senos-en-miami":
        {"slug": "implantes-de-senos-en-miami", "lang": "es", "kw": BREAST_ES},
    "https://avanaplasticsurgery.com/espanol/aumento-de-senos-miami":
        {"slug": "aumento-de-senos-miami", "lang": "es", "kw": BREAST_ES},
    "https://avanaplasticsurgery.com/mommy-makeover-miami":
        {"slug": "mommy-makeover-miami", "lang": "en", "kw": MMO_EN},
    "https://avanaplasticsurgery.com/espanol/mommy-makeover-en-miami":
        {"slug": "mommy-makeover-en-miami", "lang": "es", "kw": MMO_ES},
    "https://avanaplasticsurgery.com/liposuction-miami":
        {"slug": "liposuction-miami", "lang": "en", "kw": LIPOSUCTION_EN},
    "https://avanaplasticsurgery.com/espanol/liposuccion-en-miami-florida":
        {"slug": "liposuccion-en-miami-florida", "lang": "es", "kw": LIPOSUCCION_ES},
}


def strip_accents(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("ñ", "n")


def normalize(raw):
    for tag in ("script", "style", "noscript"):
        raw = re.sub(r"(?is)<%s.*?</%s>" % (tag, tag), " ", raw)
    raw = re.sub(r"(?is)<!--.*?-->", " ", raw)
    raw = re.sub(r"(?is)<(nav|footer|header|form|svg)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    raw = strip_accents(htmllib.unescape(raw).lower())
    raw = re.sub(r"[^a-z0-9\s]", " ", raw)
    return re.sub(r"\s+", " ", raw)


def decoded(r):
    """Return the response body as text, decoded with the right charset.

    Many pages send `Content-Type: text/html` with NO charset; requests then
    defaults to ISO-8859-1 (latin-1), which mangles UTF-8 accents
    (e.g. "glúteos" -> "gla"). When the header omits a charset we fall back to
    chardet's detection so Spanish/accented keywords count correctly."""
    if "charset=" not in r.headers.get("Content-Type", "").lower():
        r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def fetch_text(url):
    """Return normalized page text, or None if unreachable/blocked."""
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=30, allow_redirects=True)
        if r.status_code != 200:
            return None
        text = decoded(r)
        if len(text) < 2000:
            return None
        return normalize(text)
    except Exception:
        return None


def wayback_fetch(url):
    """Fallback for blocked/unreachable pages: fetch the most recent Wayback
    Machine snapshot. Returns (normalized_text, 'YYYY-MM-DD' crawl date) or
    (None, None) if the archive has no usable capture."""
    try:
        cdx = ("http://web.archive.org/cdx/search/cdx?url=" + quote(url, safe="") +
               "&output=json&fl=timestamp,original&filter=statuscode:200"
               "&collapse=digest&limit=-5")
        r = requests.get(cdx, headers={"User-Agent": UA}, timeout=30)
        rows = r.json()
        if not rows or len(rows) < 2:        # rows[0] is the header
            return None, None
        ts, original = rows[-1][0], rows[-1][1]    # most recent capture
        time.sleep(REQUEST_DELAY)                   # pace the two archive.org calls
        # "id_" returns the raw archived page without Wayback's injected toolbar
        snap = "https://web.archive.org/web/{}id_/{}".format(ts, original)
        r2 = requests.get(snap, headers={"User-Agent": UA}, timeout=40, allow_redirects=True)
        if r2.status_code != 200:
            return None, None
        text = decoded(r2)
        if len(text) < 2000:
            return None, None
        crawl_date = "{}-{}-{}".format(ts[0:4], ts[4:6], ts[6:8])
        return normalize(text), crawl_date
    except Exception:
        return None, None


def count(text, phrase):
    return len(re.findall(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text))


def prior_live_counts(entry, domain, nkw, before_date):
    """Most recent prior scan (before `before_date`) where `domain` was measured
    live or manually — never from Wayback. Returns (column_values, origin_date)
    or (None, None). Lets a blocked page reuse its last real counts instead of
    reaching for a years-old archive."""
    scans = (entry or {}).get("scans", {})
    for d in sorted(scans.keys(), reverse=True):
        if d >= before_date:
            continue
        scan = scans[d]
        sites = scan.get("sites", [])
        idx = next((i for i, s in enumerate(sites) if s.get("domain") == domain), None)
        if idx is None:
            continue
        s = sites[idx]
        if not s.get("ok") or s.get("archived") or s.get("source") in ("wayback", "none"):
            continue
        cnts = scan.get("counts", [])
        if len(cnts) != nkw:
            continue
        col = [cnts[r][idx] for r in range(nkw)]
        origin = s.get("carried_from") or d        # propagate the real measurement date
        return col, origin
    return None, None


def short_label(domain):
    name = domain.replace("www.", "").split(".")[0]
    return name[:14]


def scan_page(target_url, cfg, report_item, date, entry):
    """Build one day's scan for a single target page."""
    kw = cfg["kw"]
    competitors = report_item.get("top_10_competitors", [])

    sites = []        # column metadata
    urls = []         # source URL per column (for fetching)
    target_netloc = urlparse(target_url).netloc.replace("www.", "")

    for c in competitors:
        url = c.get("url", "")
        domain = urlparse(url).netloc.replace("www.", "")
        if url.rstrip("/") == target_url.rstrip("/"):
            continue  # the target itself — added separately as the Avana column
        if any(sd in domain for sd in SKIP_DOMAINS):
            continue
        label = short_label(domain)
        if domain == target_netloc:
            # another of our own pages ranking — disambiguate from the target
            seg = [p for p in urlparse(url).path.split("/") if p]
            tail = seg[-1] if seg else "page"
            domain = domain + "/" + tail
            label = "Avana·" + tail[:10]
        sites.append({"label": label, "domain": domain,
                      "pos": c.get("position"), "avana": False})
        urls.append(url)

    # Avana target column (always present, even if not ranking)
    pos = report_item.get("position")
    sites.append({"label": "Avana", "domain": urlparse(target_url).netloc.replace("www.", ""),
                  "pos": pos if isinstance(pos, int) else None, "avana": True})
    urls.append(target_url)

    # Fetch each column. Source preference (recorded in site["source"]):
    #   "live"    — fetched live just now
    #   blocked   -> fetch the Wayback snapshot AND look up the last live/manual
    #                count in history, then keep whichever is more RECENT:
    #     "carried" — last live/manual count is newer (site["carried_from"])
    #     "wayback" — the Wayback crawl is newer (site["archived"] = crawl date)
    #   "none"    — unreachable everywhere
    texts = []            # per-column normalized text (None when not text-sourced)
    override = {}         # column index -> precomputed counts column (carried)
    for i, (site, url) in enumerate(zip(sites, urls)):
        if i > 0:
            time.sleep(REQUEST_DELAY)     # pace requests across columns
        t = fetch_text(url)
        if t is not None:
            site["ok"], site["source"] = True, "live"
            texts.append(t)
            continue
        # live blocked — gather both fallbacks, then pick the freshest by date
        col, origin = prior_live_counts(entry, site["domain"], len(kw), date)
        wb_text, crawl_date = wayback_fetch(url)
        use_carry = col is not None and (wb_text is None or origin >= crawl_date)
        if use_carry:
            site["ok"], site["source"] = True, "carried"
            site["carried_from"] = origin
            override[i] = col
            texts.append(None)
            print(f"    (carried forward: {site['domain']} from {origin})")
        elif wb_text is not None:
            site["ok"], site["source"] = True, "wayback"
            site["archived"] = crawl_date         # served from archive, not live
            texts.append(wb_text)
            print(f"    (archived fallback: {site['domain']} @ {crawl_date})")
        else:
            site["ok"], site["source"] = False, "none"
            texts.append(None)

    # counts[keyword_index][site_index]
    counts = []
    for r, (_, variants) in enumerate(kw):
        row = []
        for i, t in enumerate(texts):
            if i in override:
                row.append(override[i][r])
            else:
                row.append(sum(count(t, v) for v in variants) if t else 0)
        counts.append(row)

    return {
        "sites": sites,
        "counts": counts,
    }


def main():
    import sys
    # Optional CLI arg: a specific report date (YYYY-MM-DD) to scan/backfill.
    # NOTE: keyword counts always come from the LIVE pages at run time, so
    # backfilling a past date reflects today's page content (only that day's
    # competitor SET and SERP positions are historical).
    date = sys.argv[1] if len(sys.argv) > 1 else datetime.now(MIAMI).strftime("%Y-%m-%d")
    report_path = f"reports/{date}.json"
    if not os.path.exists(report_path):
        # fall back to the newest dated report
        dated = sorted(glob.glob("reports/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].json"))
        if not dated:
            print("keyword_scan: no report file found; skipping.")
            return
        report_path = dated[-1]
        date = os.path.basename(report_path)[:10]
    with open(report_path, encoding="utf-8") as fh:
        report = json.load(fh)

    by_url = {r.get("target_url"): r for r in report}

    hist_path = "reports/keyword-history.json"
    history = {}
    if os.path.exists(hist_path):
        try:
            with open(hist_path, encoding="utf-8") as fh:
                history = json.load(fh)
        except Exception:
            history = {}

    for target_url, cfg in PAGES.items():
        item = by_url.get(target_url)
        if not item:
            print(f"keyword_scan: no report row for {target_url}; skipping.")
            continue
        slug = cfg["slug"]
        entry = history.get(slug, {})
        print(f"Scanning keywords for {slug} ({date})...")
        scan = scan_page(target_url, cfg, item, date, entry)

        entry["keyword"] = item.get("keyword", "")
        entry["target_url"] = target_url
        entry["lang"] = cfg["lang"]
        entry["keywords"] = [label for label, _ in cfg["kw"]]
        scans = entry.get("scans", {})
        scans[date] = scan
        entry["scans"] = scans
        history[slug] = entry

    with open(hist_path, "w", encoding="utf-8") as fh:
        json.dump(history, fh, ensure_ascii=False)

    js = "// Auto-generated by keyword_scan.py — do not edit manually\n"
    js += "window.KEYWORD_HISTORY = " + json.dumps(history, ensure_ascii=False) + ";\n"
    with open("reports/keyword-history.js", "w", encoding="utf-8") as fh:
        fh.write(js)

    print(f"keyword_scan: wrote {len(history)} page(s) to keyword-history.json/.js")


if __name__ == "__main__":
    main()
