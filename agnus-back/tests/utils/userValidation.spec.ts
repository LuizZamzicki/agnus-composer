import { isValidEmail } from "../../src/utils/userValidation";

describe("isValidEmail", () => {
  it("aceita e-mail comum e recusa formato invalido", () => {
    expect(isValidEmail("ana@agnus.fit")).toBe(true);
    expect(isValidEmail("ana@agnus")).toBe(false);
  });

  it("recusa texto acima do limite antes de avaliar a regex", () => {
    const test = jest.spyOn(RegExp.prototype, "test");
    expect(isValidEmail(`a@${"b".repeat(250)}.com`)).toBe(false);
    expect(test).not.toHaveBeenCalled();
    test.mockRestore();
  });
});
