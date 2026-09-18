import { describe, expect, it } from "vitest";
import { findSalary, findTechnologies } from "./extract";

describe("findSalary", () => {
  it.each([
    ["Sueldo: 250$ mensuales", { currency: "USD", amounts: [250] }],
    ["Pagamos $1,500 al mes", { currency: "USD", amounts: [1500] }],
    ["Salario: 2.200 a 2.800 USD mensuales", { currency: "USD", amounts: [2200, 2800] }],
    ["entre 3k usd y más", { currency: "USD", amounts: [3000] }],
    ["Pago de 4.500 Bs semanales", { currency: "VES", amounts: [4500] }],
  ])("reads %j", (text, expected) => {
    expect(findSalary(text)).toEqual(expected);
  });

  it("prefers USD when both currencies appear", () => {
    expect(findSalary("150$ pagados en Bs a tasa BCV")?.currency).toBe("USD");
  });

  it("returns null without a currency marker", () => {
    expect(findSalary("Sueldo a convenir, 3 años de experiencia")).toBeNull();
  });
});

describe("findTechnologies", () => {
  it("lists every technology in a unicorn offer", () => {
    const text =
      "React, Angular y Vue, Node.js, Python y PHP (Laravel). PostgreSQL, MySQL, SQL Server, " +
      "Oracle y MongoDB. AWS, Docker, Kubernetes, CI/CD. IA y machine learning.";
    expect(findTechnologies(text)).toEqual([
      "React",
      "Angular",
      "Vue",
      "Node.js",
      "Python",
      "PHP",
      "Laravel",
      "PostgreSQL",
      "MySQL",
      "SQL Server",
      "Oracle",
      "MongoDB",
      "AWS",
      "Docker",
      "Kubernetes",
      "CI/CD",
      "Machine learning",
      "IA",
    ]);
  });

  it("does not read JavaScript into .js suffixes", () => {
    expect(findTechnologies("Node.js, Vue.js y Next.js")).toEqual(["Vue", "Next.js", "Node.js"]);
  });

  it("does not confuse JavaScript with Java or React Native with React", () => {
    expect(findTechnologies("JavaScript y React Native")).toEqual(["JavaScript", "React Native"]);
  });
});
