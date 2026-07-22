#!/usr/bin/env python3
"""
analizar_speedup.py

Lee resultados_speedup.csv (generado por medir_speedup.sh, modo trabajo
fijo) y calcula:
  - Speedup = tiempo_secuencial / tiempo_paralelo
  - Eficiencia = Speedup / trabajadores   (trabajadores = procesos * hilos)

La corrida base (secuencial) es la de 1 proceso x 1 hilo. Si no existe
en el CSV, usa la combinación con menos trabajadores como referencia.

Genera 3 gráficas en outputs_speedup/:
  - throughput_vs_trabajadores.png
  - speedup_vs_trabajadores.png (con línea de speedup ideal)
  - eficiencia_vs_trabajadores.png
"""
import csv
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

CSV_ENTRADA = "resultados_speedup.csv"
DIR_SALIDA = "outputs_speedup"


def cargar_datos(path):
    filas = []
    with open(path, newline="") as f:
        lector = csv.DictReader(f)
        for r in lector:
            filas.append({
                "procesos": int(r["procesos"]),
                "hilos": int(r["hilos"]),
                "sensores": int(r["sensores"]),
                "repeticiones": int(r["repeticiones"]),
                "tiempo_seg": float(r["tiempo_seg"]),
                "mensajes": int(r["mensajes"]),
                "throughput_msgs_seg": float(r["throughput_msgs_seg"]),
            })
    return filas


def calcular_metricas(filas):
    base = next((f for f in filas if f["procesos"] == 1 and f["hilos"] == 1), None)
    if base is None:
        base = min(filas, key=lambda f: f["procesos"] * f["hilos"])
        print(f"[aviso] no hay corrida 1x1 en el CSV, usando "
              f"{base['procesos']}x{base['hilos']} como referencia")

    tiempo_base = base["tiempo_seg"]

    for f in filas:
        trabajadores = f["procesos"] * f["hilos"]
        f["trabajadores"] = trabajadores
        f["speedup"] = tiempo_base / f["tiempo_seg"] if f["tiempo_seg"] > 0 else 0.0
        f["eficiencia"] = f["speedup"] / trabajadores if trabajadores > 0 else 0.0

    return filas, base


def graficar(filas, base):
    os.makedirs(DIR_SALIDA, exist_ok=True)
    filas_ordenadas = sorted(filas, key=lambda f: f["trabajadores"])
    trabajadores = [f["trabajadores"] for f in filas_ordenadas]
    throughput = [f["throughput_msgs_seg"] for f in filas_ordenadas]
    speedup = [f["speedup"] for f in filas_ordenadas]
    eficiencia = [f["eficiencia"] for f in filas_ordenadas]
    etiquetas = [f"{f['procesos']}p x {f['hilos']}h" for f in filas_ordenadas]

    # --- Throughput vs trabajadores ---
    plt.figure(figsize=(8, 5))
    plt.plot(trabajadores, throughput, "o-", color="#2563eb")
    for x, y, et in zip(trabajadores, throughput, etiquetas):
        plt.annotate(et, (x, y), textcoords="offset points", xytext=(0, 8), fontsize=8)
    plt.xlabel("Trabajadores (procesos MPI x hilos)")
    plt.ylabel("Throughput (msgs/seg)")
    plt.title("Throughput vs. número de trabajadores")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(DIR_SALIDA, "throughput_vs_trabajadores.png"), dpi=150)
    plt.close()

    # --- Speedup vs trabajadores (con línea ideal) ---
    plt.figure(figsize=(8, 5))
    plt.plot(trabajadores, speedup, "o-", color="#16a34a", label="Speedup medido")
    max_trab = max(trabajadores)
    plt.plot([1, max_trab], [1, max_trab], "--", color="#9ca3af", label="Speedup ideal (lineal)")
    for x, y, et in zip(trabajadores, speedup, etiquetas):
        plt.annotate(et, (x, y), textcoords="offset points", xytext=(0, 8), fontsize=8)
    plt.xlabel("Trabajadores (procesos MPI x hilos)")
    plt.ylabel("Speedup")
    plt.title(f"Speedup vs. número de trabajadores (base: {base['procesos']}p x {base['hilos']}h)")
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(DIR_SALIDA, "speedup_vs_trabajadores.png"), dpi=150)
    plt.close()

    # --- Eficiencia vs trabajadores ---
    plt.figure(figsize=(8, 5))
    plt.plot(trabajadores, eficiencia, "o-", color="#dc2626")
    plt.axhline(1.0, linestyle="--", color="#9ca3af", label="Eficiencia ideal (1.0)")
    for x, y, et in zip(trabajadores, eficiencia, etiquetas):
        plt.annotate(et, (x, y), textcoords="offset points", xytext=(0, 8), fontsize=8)
    plt.xlabel("Trabajadores (procesos MPI x hilos)")
    plt.ylabel("Eficiencia (Speedup / trabajadores)")
    plt.title("Eficiencia vs. número de trabajadores")
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(DIR_SALIDA, "eficiencia_vs_trabajadores.png"), dpi=150)
    plt.close()


def main():
    if not os.path.exists(CSV_ENTRADA):
        print(f"No se encontró {CSV_ENTRADA}. Corre primero ./scripts/medir_speedup.sh")
        return

    filas = cargar_datos(CSV_ENTRADA)
    filas, base = calcular_metricas(filas)

    print(f"\nReferencia (secuencial): {base['procesos']}p x {base['hilos']}h "
          f"-> {base['tiempo_seg']:.4f}s\n")
    print(f"{'procesos':>9} {'hilos':>6} {'trabajad.':>10} {'tiempo(s)':>10} "
          f"{'throughput':>12} {'speedup':>9} {'eficiencia':>11}")
    for f in sorted(filas, key=lambda f: f["trabajadores"]):
        print(f"{f['procesos']:>9} {f['hilos']:>6} {f['trabajadores']:>10} "
              f"{f['tiempo_seg']:>10.4f} {f['throughput_msgs_seg']:>12.1f} "
              f"{f['speedup']:>9.3f} {f['eficiencia']:>11.3f}")

    graficar(filas, base)
    print(f"\nGráficas guardadas en {DIR_SALIDA}/")


if __name__ == "__main__":
    main()