package com.hvhn.backend.service;

import com.hvhn.backend.model.CommunityAnswer;
import com.hvhn.backend.model.CommunityQuestion;
import com.hvhn.backend.model.CommunityVote;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.CommunityAnswerRepository;
import com.hvhn.backend.repository.CommunityQuestionRepository;
import com.hvhn.backend.repository.CommunityVoteRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class CommunityQuestionService {

    private final CommunityQuestionRepository questionRepository;
    private final CommunityAnswerRepository answerRepository;
    private final CommunityVoteRepository voteRepository;
    private final CommunityPermissionService permissions;

    public CommunityQuestionService(CommunityQuestionRepository questionRepository,
                                    CommunityAnswerRepository answerRepository,
                                    CommunityVoteRepository voteRepository,
                                    CommunityPermissionService permissions) {
        this.questionRepository = questionRepository;
        this.answerRepository = answerRepository;
        this.voteRepository = voteRepository;
        this.permissions = permissions;
    }

    public List<CommunityQuestion> listQuestions(String communityId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        return questionRepository.findByCommunityIdAndDeletedAtIsNullOrderByCreatedAtDesc(communityId);
    }

    public CommunityQuestion createQuestion(String communityId, Map<String, Object> payload, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        String title = required(payload, "title", 5, 160);
        String body = required(payload, "body", 10, 4000);
        CommunityQuestion question = new CommunityQuestion();
        question.setCommunityId(communityId);
        question.setAuthorUserId(currentUser.getId());
        question.setTitle(title);
        question.setBody(body);
        question.setTags(list(payload.get("tags")));
        question.setCreatedAt(LocalDateTime.now().withNano(0));
        return questionRepository.save(question);
    }

    public Map<String, Object> getQuestion(String communityId, String questionId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        CommunityQuestion question = findQuestion(communityId, questionId);
        return Map.of("question", question, "answers", answerRepository.findByQuestionIdAndDeletedAtIsNullOrderByCreatedAtAsc(questionId));
    }

    public CommunityAnswer createAnswer(String communityId, String questionId, Map<String, String> payload, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        findQuestion(communityId, questionId);
        String body = required(payload, "body", 2, 4000);
        CommunityAnswer answer = new CommunityAnswer();
        answer.setCommunityId(communityId);
        answer.setQuestionId(questionId);
        answer.setAuthorUserId(currentUser.getId());
        answer.setBody(body);
        answer.setCreatedAt(LocalDateTime.now().withNano(0));
        CommunityAnswer saved = answerRepository.save(answer);
        CommunityQuestion question = findQuestion(communityId, questionId);
        question.setAnswerCount(answerRepository.countByQuestionIdAndDeletedAtIsNull(questionId));
        questionRepository.save(question);
        return saved;
    }

    public CommunityQuestion upvoteQuestion(String communityId, String questionId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        findQuestion(communityId, questionId);
        addVote(communityId, currentUser.getId(), "QUESTION", questionId);
        CommunityQuestion question = findQuestion(communityId, questionId);
        question.setUpvoteCount(voteRepository.countByTargetTypeAndTargetId("QUESTION", questionId));
        return questionRepository.save(question);
    }

    public CommunityQuestion removeQuestionVote(String communityId, String questionId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        voteRepository.deleteByUserIdAndTargetTypeAndTargetId(currentUser.getId(), "QUESTION", questionId);
        CommunityQuestion question = findQuestion(communityId, questionId);
        question.setUpvoteCount(voteRepository.countByTargetTypeAndTargetId("QUESTION", questionId));
        return questionRepository.save(question);
    }

    public CommunityAnswer upvoteAnswer(String communityId, String questionId, String answerId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        CommunityAnswer answer = findAnswer(communityId, questionId, answerId);
        addVote(communityId, currentUser.getId(), "ANSWER", answerId);
        answer.setUpvoteCount(voteRepository.countByTargetTypeAndTargetId("ANSWER", answerId));
        return answerRepository.save(answer);
    }

    public CommunityAnswer removeAnswerVote(String communityId, String questionId, String answerId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        CommunityAnswer answer = findAnswer(communityId, questionId, answerId);
        voteRepository.deleteByUserIdAndTargetTypeAndTargetId(currentUser.getId(), "ANSWER", answerId);
        answer.setUpvoteCount(voteRepository.countByTargetTypeAndTargetId("ANSWER", answerId));
        return answerRepository.save(answer);
    }

    public CommunityAnswer acceptAnswer(String communityId, String questionId, String answerId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        CommunityQuestion question = findQuestion(communityId, questionId);
        if (!question.getAuthorUserId().equals(currentUser.getId()) && !permissions.canModerate(currentUser, communityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the question author can accept an answer.");
        }
        CommunityAnswer answer = findAnswer(communityId, questionId, answerId);
        answerRepository.findByQuestionIdAndAcceptedTrue(questionId).forEach(existing -> {
            existing.setAccepted(false);
            answerRepository.save(existing);
        });
        answer.setAccepted(true);
        CommunityAnswer saved = answerRepository.save(answer);
        question.setAcceptedAnswerId(answerId);
        question.setStatus("ANSWERED");
        questionRepository.save(question);
        return saved;
    }

    public void deleteQuestion(String communityId, String questionId, User currentUser) {
        CommunityQuestion question = findQuestion(communityId, questionId);
        if (!question.getAuthorUserId().equals(currentUser.getId()) && !permissions.canModerate(currentUser, communityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this question.");
        }
        question.setDeletedAt(LocalDateTime.now().withNano(0));
        question.setStatus("DELETED");
        questionRepository.save(question);
    }

    private void addVote(String communityId, String userId, String targetType, String targetId) {
        if (voteRepository.findByUserIdAndTargetTypeAndTargetId(userId, targetType, targetId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already voted.");
        }
        CommunityVote vote = new CommunityVote();
        vote.setCommunityId(communityId);
        vote.setUserId(userId);
        vote.setTargetType(targetType);
        vote.setTargetId(targetId);
        try {
            voteRepository.save(vote);
        } catch (DuplicateKeyException duplicate) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already voted.");
        }
    }

    private CommunityQuestion findQuestion(String communityId, String questionId) {
        return questionRepository.findByIdAndCommunityIdAndDeletedAtIsNull(questionId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found."));
    }

    private CommunityAnswer findAnswer(String communityId, String questionId, String answerId) {
        return answerRepository.findByIdAndQuestionIdAndCommunityIdAndDeletedAtIsNull(answerId, questionId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Answer not found."));
    }

    private String required(Map<?, ?> payload, String key, int min, int max) {
        Object value = payload == null ? null : payload.get(key);
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.length() < min || text.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " length is invalid.");
        }
        return text;
    }

    private List<String> list(Object value) {
        if (!(value instanceof List<?> entries)) return List.of();
        return entries.stream().map(String::valueOf).map(String::trim).filter(StringUtils::hasText).limit(10).toList();
    }
}
