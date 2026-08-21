// 样例简历文本(4.2 fixture 源):PDF 与 DOCX 两版 fixture 由 scripts/generate-resume-fixtures.ts
// 用同一常量生成,解析测试据此断言提取一致性。内容含量化表达与关键词(4.6 ATS 规则测试也复用)。
export const SAMPLE_RESUME_TEXT = `张伟
求职意向:后端开发工程师
联系电话:138-0000-0000
邮箱:zhangwei@example.com

教育经历
2016-09 至 2020-06 中国科学技术大学 计算机科学与技术 本科

技能
Java、Spring Boot、MySQL、Redis、Docker、Git

工作经历
2020-07 至 2023-06 杭州某科技有限公司 后端开发工程师
负责电商订单系统的开发与维护,日均处理订单 50 万笔
优化数据库查询,接口响应时间从 800ms 降低到 200ms
主导商品服务重构,线上故障率下降 60%

项目经历
2023-01 至 2023-05 分布式秒杀系统(个人项目)
设计并实现基于 Redis 的库存预扣方案,压测 QPS 达到 5000
`;
