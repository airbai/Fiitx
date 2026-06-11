function normalizeSkill(skill) {
  if (!skill) {
    return null;
  }
  return {
    id: skill.id || skill.name || skill.root,
    name: skill.name || skill.id || "unnamed-skill",
    root: skill.root || "",
    description: skill.mcp?.description || skill.skillPrompt?.slice(0, 180) || "",
    capabilities: Array.isArray(skill.mcp?.capabilities) ? skill.mcp.capabilities : [],
    apis: Array.isArray(skill.mcp?.apis) ? skill.mcp.apis : [],
    prompt: skill.skillPrompt || "",
    raw: skill
  };
}

function createSkillRegistry({ wechatAiSkillGateway } = {}) {
  const skills = new Map();

  function register(skill) {
    const normalized = normalizeSkill(skill);
    if (!normalized?.id) {
      throw new Error("Skill descriptor must include id/name/root");
    }
    skills.set(normalized.id, normalized);
    return normalized;
  }

  function discoverWechatSkills(options = {}) {
    if (!wechatAiSkillGateway?.discoverSkills) {
      return [];
    }
    const discovered = wechatAiSkillGateway.discoverSkills(options.skillsRoot).map(register);
    return discovered;
  }

  function selectSkillForPrompt(payload = {}) {
    if (wechatAiSkillGateway?.selectSkillForPrompt) {
      const selected = wechatAiSkillGateway.selectSkillForPrompt({
        prompt: payload.prompt,
        skillRoot: payload.skillRoot,
        skillsRoot: payload.skillsRoot
      });
      if (selected?.selected) {
        register(selected.selected);
      }
      return selected;
    }
    return {
      selected: null,
      ranked: []
    };
  }

  return {
    discoverWechatSkills,
    get(id) {
      return skills.get(id);
    },
    list() {
      return [...skills.values()];
    },
    register,
    selectSkillForPrompt
  };
}

module.exports = {
  createSkillRegistry
};
